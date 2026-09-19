import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../src/index.ts';

function setup(t) {
  const db = new DatabaseSync(':memory:');
  db.exec(
    readFileSync(new URL('../migrations/0001_create_inquiries.sql', import.meta.url), 'utf8'),
  );
  t.after(() => db.close());
  const queued = [],
    dead = [],
    emails = [];
  const env = {
    ALLOWED_ORIGINS: 'https://lakelandcabaretui-dev.pages.dev',
    FROM_ADDRESS: 'contact-form@experiencewhimsy.com',
    TO_ADDRESS: 'Contact@LakelandCabaret.com',
    CONTACT_DB: {
      prepare(sql) {
        const statement = db.prepare(sql);
        const query = (args) => ({
          async first() {
            return statement.get(...args) ?? null;
          },
          async all() {
            return { results: statement.all(...args) };
          },
          async run() {
            return { meta: { changes: statement.run(...args).changes } };
          },
        });
        return { bind: (...args) => query(args), ...query([]) };
      },
    },
    CONTACT_QUEUE: {
      async send(body) {
        queued.push(body);
      },
    },
    CONTACT_DLQ: {
      async send(body) {
        dead.push(body);
      },
    },
    CONTACT_EMAIL: {
      async send(body) {
        emails.push(body);
        return { messageId: 'mail-123' };
      },
    },
  };
  const payload = {
    submissionId: crypto.randomUUID(),
    desiredDate: '2027-02-28',
    name: 'Jane Visitor',
    email: 'jane@example.com',
    service: 'Music & DJ',
    details: 'A wedding for 100 guests.',
    website: '',
  };
  const submit = (body = payload, origin = env.ALLOWED_ORIGINS) =>
    worker.fetch(
      new Request('https://worker.test', {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      env,
    );
  const inquiry = () => db.prepare('SELECT * FROM inquiries').get();
  async function deliver(attempts = 1) {
    const result = { acked: false, retry: null };
    await worker.queue(
      {
        queue: 'lakeland-contact-email',
        messages: [
          {
            body: { inquiryId: inquiry().id },
            attempts,
            ack() {
              result.acked = true;
            },
            retry(options) {
              result.retry = options;
            },
          },
        ],
      },
      env,
    );
    return result;
  }
  return { db, env, queued, dead, emails, payload, submit, inquiry, deliver };
}

test('requires every field, a real date, valid email, and a permitted origin', async (t) => {
  const s = setup(t);
  for (const field of ['name', 'email', 'service', 'details', 'desiredDate']) {
    assert.equal((await s.submit({ ...s.payload, [field]: '  ' })).status, 400, field);
  }
  for (const desiredDate of ['2027-02-30', 'not-a-date'])
    assert.equal((await s.submit({ ...s.payload, desiredDate })).status, 400);
  assert.equal((await s.submit({ ...s.payload, email: 'bad-email' })).status, 400);
  assert.equal((await s.submit({ ...s.payload, website: 'spam' })).status, 400);
  assert.equal((await s.submit({ ...s.payload, details: 'x'.repeat(40_000) })).status, 413);
  assert.equal((await s.submit(s.payload, 'https://untrusted.example')).status, 403);
  assert.equal(s.inquiry(), undefined);
  assert.equal(s.queued.length, 0);
});

test('stores all fields before enqueueing and deduplicates simultaneous submissions', async (t) => {
  const s = setup(t);
  const results = await Promise.all([s.submit(), s.submit(), s.submit()]);
  for (const response of results) assert.equal((await response.json()).saved, true);
  assert.equal(s.inquiry().desiredDate, s.payload.desiredDate);
  assert.equal(s.inquiry().details, s.payload.details);
  assert.equal(s.queued.length, 1);
  assert.equal(s.emails.length, 0);
});

test('storage failure never reports success or queues an email', async (t) => {
  const s = setup(t);
  s.env.CONTACT_DB.prepare = () => {
    throw new Error('Database unavailable');
  };
  const response = await s.submit();
  assert.equal(response.status, 503);
  assert.equal((await response.json()).ok, false);
  assert.equal(s.queued.length, 0);
});

test('queue outage retains the inquiry and scheduled recovery enqueues it', async (t) => {
  const s = setup(t);
  const send = s.env.CONTACT_QUEUE.send;
  s.env.CONTACT_QUEUE.send = async () => {
    throw new Error('Queue unavailable');
  };
  const result = await (await s.submit()).json();
  assert.equal(result.saved, true);
  assert.equal(result.queued, false);
  assert.equal(s.inquiry().status, 'queue_failed');
  s.env.CONTACT_QUEUE.send = send;
  let job;
  await worker.scheduled({}, s.env, {
    waitUntil(promise) {
      job = promise;
    },
  });
  await job;
  assert.equal(s.queued.length, 1);
  assert.equal(s.inquiry().status, 'queued');
});

test('email includes all fields, escapes markup, sets reply-to, and is sent once', async (t) => {
  const s = setup(t);
  await s.submit({ ...s.payload, details: '<script>bad()</script>\nSecond line' });
  assert.equal((await s.deliver()).acked, true);
  const email = s.emails[0];
  assert.equal(email.to, 'Contact@LakelandCabaret.com');
  assert.equal(email.replyTo, s.payload.email);
  for (const field of ['desiredDate', 'service', 'name', 'email'])
    assert.ok(email.text.includes(s.payload[field]));
  assert.ok(email.html.includes('&lt;script&gt;'));
  assert.ok(!email.html.includes('<script>'));
  assert.equal(s.inquiry().status, 'accepted');
  await s.deliver();
  assert.equal(s.emails.length, 1);
});

test('matches Whimsy retry delays and preserves exhausted failures in the dead-letter queue', async (t) => {
  const s = setup(t);
  await s.submit();
  s.env.CONTACT_EMAIL.send = async () => {
    throw Object.assign(new Error('Temporary failure'), { code: 'E_DELIVERY_FAILED' });
  };
  for (const delay of [60, 300, 900, 3600]) {
    // Fresh queue attempt counts must not reset the durable retry budget.
    const result = await s.deliver(1);
    assert.deepEqual(result.retry, { delaySeconds: delay });
    assert.equal(s.inquiry().status, 'retrying');
    s.db.exec('UPDATE inquiries SET next_attempt_at = NULL');
  }
  assert.equal((await s.deliver()).acked, true);
  assert.equal(s.inquiry().delivery_attempts, 5);
  assert.equal(s.inquiry().status, 'failed');
  assert.equal(s.dead.length, 1);
});

test('permanent email failures are retained without repeated sending', async (t) => {
  const s = setup(t);
  await s.submit();
  s.env.CONTACT_EMAIL.send = async () => {
    throw Object.assign(new Error('Invalid sender'), { code: 'E_INVALID_SENDER' });
  };
  assert.equal((await s.deliver()).acked, true);
  assert.equal(s.inquiry().status, 'failed');
  assert.equal(s.dead.length, 1);
  await s.deliver();
  assert.equal(s.inquiry().delivery_attempts, 1);
});

test('concurrent deliveries cannot send two emails', async (t) => {
  const s = setup(t);
  await s.submit();
  await Promise.all([s.deliver(), s.deliver()]);
  assert.equal(s.emails.length, 1);
});

test('delivery events distinguish accepted from delivered and ignore stale events', async (t) => {
  const s = setup(t);
  await s.submit();
  await s.deliver();
  const record = (type, eventTimestamp) =>
    worker.queue(
      {
        queue: 'lakeland-contact-email-events',
        messages: [
          {
            body: {
              type: `cf.email.sending.message.${type}`,
              payload: { messageId: 'mail-123', delivery: { smtpStatusCode: '250' } },
              metadata: { eventTimestamp },
            },
            attempts: 1,
            ack() {},
            retry() {},
          },
        ],
      },
      s.env,
    );
  await record('delivered', '2027-01-01T00:00:00.000Z');
  assert.equal(s.inquiry().status, 'delivered');
  await record('deferred', '2026-01-01T00:00:00.000Z');
  assert.equal(s.inquiry().status, 'delivered');
  await s.deliver();
  assert.equal(s.emails.length, 1);
});
