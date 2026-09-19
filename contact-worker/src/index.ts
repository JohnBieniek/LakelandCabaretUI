interface ContactPayload {
  submissionId?: unknown;
  name?: unknown;
  desiredDate?: unknown;
  email?: unknown;
  service?: unknown;
  details?: unknown;
  website?: unknown;
}
interface DeliveryMessage {
  inquiryId: string;
}
interface EmailDeliveryEvent {
  type: string;
  payload?: {
    messageId?: string;
    terminal?: boolean;
    delivery?: { status?: string; smtpStatusCode?: string; smtpResponse?: string };
    bounce?: { type?: string; classification?: string; reason?: string };
  };
  metadata?: { eventTimestamp?: string };
}
interface InquiryRow {
  id: string;
  reference: string;
  name: string;
  desiredDate: string;
  email: string;
  service: string;
  details: string;
  status: string;
  delivery_attempts: number;
  next_attempt_at: string | null;
}

const limits = { name: 100, desiredDate: 10, email: 254, service: 100, details: 5000 } as const;
const retryDelays = [60, 300, 900, 3600] as const;
const retryableCodes = new Set([
  'E_RATE_LIMIT_EXCEEDED',
  'E_DELIVERY_FAILED',
  'E_INTERNAL_SERVER_ERROR',
]);

function isAllowedOrigin(origin: string, env: Env): boolean {
  const configuredOrigins = new Set(env.ALLOWED_ORIGINS.split(',').map((value) => value.trim()));
  if (configuredOrigins.has(origin)) return true;
  try {
    const url = new URL(origin);
    return (
      url.protocol === 'https:' &&
      ['.lakelandcabaretui-dev.pages.dev', '.lakelandcabaretui.pages.dev'].some((suffix) =>
        url.hostname.endsWith(suffix),
      )
    );
  } catch {
    return false;
  }
}
function corsHeaders(origin: string): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
function json(origin: string, body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders(origin) });
}
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function textField(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() : null;
}
function errorDetails(error: unknown): { code: string; message: string } {
  const failure = error instanceof Error ? error : new Error(String(error));
  const code = 'code' in failure && typeof failure.code === 'string' ? failure.code : 'UNKNOWN';
  return { code, message: failure.message.slice(0, 500) };
}
function publicReference(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `LKC-${date}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}
async function findInquiry(env: Env, id: string): Promise<InquiryRow | null> {
  return env.CONTACT_DB.prepare(
    'SELECT id, reference, name, desiredDate, email, service, details, status, delivery_attempts, next_attempt_at FROM inquiries WHERE id = ?',
  )
    .bind(id)
    .first<InquiryRow>();
}
async function sendInquiry(env: Env, inquiry: InquiryRow): Promise<string> {
  const subject = `Lakeland Cabaret inquiry: ${inquiry.service} [${inquiry.reference}]`;
  const text = [
    `Reference: ${inquiry.reference}`,
    `Name: ${inquiry.name}`,
    `Desired date: ${inquiry.desiredDate}`,
    `Email: ${inquiry.email}`,
    `Service: ${inquiry.service}`,
    '',
    'Event details:',
    inquiry.details,
  ].join('\n');
  const html = `<h2>New Lakeland Cabaret inquiry</h2>
    <p><strong>Reference:</strong> ${escapeHtml(inquiry.reference)}</p>
    <p><strong>Name:</strong> ${escapeHtml(inquiry.name)}</p>
    <p><strong>Desired date:</strong> ${escapeHtml(inquiry.desiredDate)}</p>
    <p><strong>Email:</strong> ${escapeHtml(inquiry.email)}</p>
    <p><strong>Service:</strong> ${escapeHtml(inquiry.service)}</p>
    <p><strong>Event details:</strong></p><p>${escapeHtml(inquiry.details).replace(/\n/g, '<br>')}</p>`;
  const result = await env.CONTACT_EMAIL.send({
    to: env.TO_ADDRESS,
    from: { email: env.FROM_ADDRESS, name: 'Lakeland Cabaret Website' },
    replyTo: inquiry.email,
    subject,
    text,
    html,
  });
  return result.messageId;
}
async function markQueued(env: Env, id: string): Promise<void> {
  const now = new Date().toISOString();
  await env.CONTACT_DB.prepare(
    "UPDATE inquiries SET status = 'queued', updated_at = ? WHERE id = ? AND status IN ('pending', 'queue_failed')",
  )
    .bind(now, id)
    .run();
}

async function acceptInquiry(request: Request, env: Env, origin: string): Promise<Response> {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))
    return json(
      origin,
      { ok: false, message: 'The form sent an unsupported request. Please refresh and try again.' },
      415,
    );
  if (Number(request.headers.get('Content-Length') ?? 0) > 32_768)
    return json(
      origin,
      {
        ok: false,
        message: 'Your message is too long to submit. Please shorten the event details.',
      },
      413,
    );
  let payload: ContactPayload;
  try {
    // Enforce the byte limit even when Content-Length is absent or incorrect.
    const reader = request.body?.getReader();
    if (!reader) throw new Error('Missing body');
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 32_768) {
        await reader.cancel();
        return json(origin, { ok: false, message: 'Your message is too long to submit.' }, 413);
      }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new Error('Invalid body');
    payload = parsed;
  } catch {
    return json(
      origin,
      { ok: false, message: 'We could not read the form. Please refresh and try again.' },
      400,
    );
  }
  if (textField(payload.website))
    return json(
      origin,
      { ok: false, message: 'We could not accept this inquiry. Please contact us directly.' },
      400,
    );
  const clientId = textField(payload.submissionId);
  const name = textField(payload.name);
  const desiredDate = textField(payload.desiredDate);
  const email = textField(payload.email);
  const service = textField(payload.service);
  const details = textField(payload.details);
  if (
    !clientId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId) ||
    !name ||
    !desiredDate ||
    !email ||
    !service ||
    !details
  )
    return json(
      origin,
      { ok: false, message: 'Please complete every required field and try again.' },
      400,
    );
  if (
    name.length > limits.name ||
    desiredDate.length > limits.desiredDate ||
    email.length > limits.email ||
    service.length > limits.service ||
    details.length > limits.details
  )
    return json(
      origin,
      { ok: false, message: 'One of the fields is too long. Please shorten it and try again.' },
      400,
    );
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return json(origin, { ok: false, message: 'Please enter a valid email address.' }, 400);
  const date = new Date(`${desiredDate}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(desiredDate) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== desiredDate
  )
    return json(origin, { ok: false, message: 'Please enter a valid desired date.' }, 400);
  if (/[\r\n]/.test(name + email + service))
    return json(
      origin,
      { ok: false, message: 'Please check your name, email address, and service.' },
      400,
    );

  const existing = await env.CONTACT_DB.prepare(
    'SELECT id, reference, status FROM inquiries WHERE client_id = ?',
  )
    .bind(clientId)
    .first<{ id: string; reference: string; status: string }>();
  if (existing)
    return json(
      origin,
      {
        ok: true,
        saved: true,
        queued: !['pending', 'queue_failed', 'failed'].includes(existing.status),
        reference: existing.reference,
        message: `Your inquiry is safely saved as ${existing.reference}. You do not need to submit it again.`,
      },
      202,
    );

  const id = crypto.randomUUID();
  const reference = publicReference();
  const now = new Date().toISOString();
  try {
    const inserted = await env.CONTACT_DB.prepare(
      `INSERT INTO inquiries (id, client_id, reference, name, desiredDate, email, service, details, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?) ON CONFLICT(client_id) DO NOTHING`,
    )
      .bind(id, clientId, reference, name, desiredDate, email, service, details, now, now)
      .run();
    if (!inserted.meta.changes) {
      const duplicate = await env.CONTACT_DB.prepare(
        'SELECT reference FROM inquiries WHERE client_id = ?',
      )
        .bind(clientId)
        .first<{ reference: string }>();
      return json(
        origin,
        {
          ok: true,
          saved: true,
          reference: duplicate?.reference,
          message: `Your inquiry is safely saved as ${duplicate?.reference}. You do not need to submit it again.`,
        },
        202,
      );
    }
  } catch (error) {
    const failure = errorDetails(error);
    console.error(
      JSON.stringify({
        message: 'contact inquiry storage failed',
        errorCode: failure.code,
        error: failure.message,
      }),
    );
    return json(
      origin,
      {
        ok: false,
        saved: false,
        message:
          'We could not safely save your inquiry. Please try again in a moment or email Contact@LakelandCabaret.com directly.',
      },
      503,
    );
  }
  try {
    await env.CONTACT_QUEUE.send({ inquiryId: id } satisfies DeliveryMessage);
    await markQueued(env, id);
    console.log(JSON.stringify({ message: 'contact inquiry queued', inquiryId: id, reference }));
    return json(
      origin,
      {
        ok: true,
        saved: true,
        queued: true,
        reference,
        message: `Thanks—your inquiry is safely saved as ${reference}.`,
      },
      202,
    );
  } catch (error) {
    const failure = errorDetails(error);
    await env.CONTACT_DB.prepare(
      "UPDATE inquiries SET status = 'queue_failed', updated_at = ?, last_error_code = ?, last_error_message = ? WHERE id = ? AND status IN ('pending', 'queue_failed')",
    )
      .bind(new Date().toISOString(), failure.code, failure.message, id)
      .run();
    console.error(
      JSON.stringify({
        message: 'contact inquiry queue failed',
        inquiryId: id,
        reference,
        errorCode: failure.code,
        error: failure.message,
      }),
    );
    return json(
      origin,
      {
        ok: true,
        saved: true,
        queued: false,
        reference,
        message: `Your inquiry is safely saved as ${reference}, but delivery is delayed. You do not need to resubmit it.`,
      },
      202,
    );
  }
}

async function deliverMessage(message: Message<DeliveryMessage>, env: Env): Promise<void> {
  const inquiry = await findInquiry(env, message.body.inquiryId);
  if (
    !inquiry ||
    [
      'accepted',
      'delivered',
      'deferred',
      'bounced',
      'failed',
      'rejected',
      'complained',
      'sent',
    ].includes(inquiry.status)
  ) {
    message.ack();
    return;
  }
  const now = new Date().toISOString();
  // A database lease prevents overlapping queue/recovery deliveries and keeps the
  // retry budget intact when a recovered message has a fresh queue attempt count.
  if (inquiry.next_attempt_at && inquiry.next_attempt_at > now) {
    message.retry({
      delaySeconds: Math.max(
        1,
        Math.ceil((Date.parse(inquiry.next_attempt_at) - Date.now()) / 1000),
      ),
    });
    return;
  }
  if (inquiry.delivery_attempts >= 5) {
    await env.CONTACT_DLQ.send({ inquiryId: inquiry.id } satisfies DeliveryMessage);
    await env.CONTACT_DB.prepare(
      "UPDATE inquiries SET status = 'failed', updated_at = ? WHERE id = ?",
    )
      .bind(now, inquiry.id)
      .run();
    message.ack();
    return;
  }
  const claimed = await env.CONTACT_DB.prepare(
    `UPDATE inquiries SET status = 'sending', delivery_attempts = delivery_attempts + 1, updated_at = ?, next_attempt_at = ?
     WHERE id = ? AND status IN ('pending', 'queue_failed', 'queued', 'retrying', 'sending')
       AND (next_attempt_at IS NULL OR next_attempt_at <= ?)`,
  )
    .bind(now, new Date(Date.now() + 15 * 60_000).toISOString(), inquiry.id, now)
    .run();
  if (!claimed.meta.changes) {
    message.retry({ delaySeconds: 60 });
    return;
  }
  const attempt = inquiry.delivery_attempts + 1;
  try {
    const messageId = await sendInquiry(env, inquiry);
    await env.CONTACT_DB.prepare(
      `UPDATE inquiries SET status = 'accepted', message_id = ?, accepted_at = ?, updated_at = ?, next_attempt_at = NULL,
       last_error_code = NULL, last_error_message = NULL WHERE id = ?`,
    )
      .bind(messageId, now, now, inquiry.id)
      .run();
    console.log(
      JSON.stringify({
        message: 'contact email accepted',
        inquiryId: inquiry.id,
        reference: inquiry.reference,
        messageId,
        attempt,
      }),
    );
    message.ack();
  } catch (error) {
    const failure = errorDetails(error);
    const retryable = retryableCodes.has(failure.code) || failure.code === 'UNKNOWN';
    const canRetry = retryable && attempt <= retryDelays.length;
    const status = canRetry ? 'retrying' : 'failed';
    const delay = retryDelays[Math.min(attempt - 1, retryDelays.length - 1)];
    // Preserve the terminal inquiry before acknowledging it; if the DLQ is down,
    // queue redelivery can retry this step without sending another email.
    if (!canRetry) await env.CONTACT_DLQ.send({ inquiryId: inquiry.id } satisfies DeliveryMessage);
    await env.CONTACT_DB.prepare(
      'UPDATE inquiries SET status = ?, updated_at = ?, next_attempt_at = ?, last_error_code = ?, last_error_message = ? WHERE id = ?',
    )
      .bind(
        status,
        new Date().toISOString(),
        canRetry ? new Date(Date.now() + delay * 1000).toISOString() : null,
        failure.code,
        failure.message,
        inquiry.id,
      )
      .run();
    console.error(
      JSON.stringify({
        message: 'contact email failed',
        inquiryId: inquiry.id,
        reference: inquiry.reference,
        attempt,
        retryable,
        errorCode: failure.code,
        error: failure.message,
      }),
    );
    if (canRetry) message.retry({ delaySeconds: delay });
    else message.ack();
  }
}
function deliveryEventStatus(event: EmailDeliveryEvent): string {
  const eventName = event.type.split('.').at(-1) ?? 'unknown';
  if (eventName === 'delivered') return 'delivered';
  if (eventName === 'deferred') return 'deferred';
  if (['bounced', 'failed', 'rejected', 'complained'].includes(eventName)) return eventName;
  return 'delivery_unknown';
}
async function recordDeliveryEvent(message: Message<EmailDeliveryEvent>, env: Env): Promise<void> {
  const event = message.body;
  const messageId = event.payload?.messageId;
  if (!messageId) {
    console.error(
      JSON.stringify({ message: 'email delivery event missing message id', eventType: event.type }),
    );
    message.ack();
    return;
  }
  const status = deliveryEventStatus(event);
  if (status === 'delivery_unknown') {
    message.ack();
    return;
  }
  const occurredAt = event.metadata?.eventTimestamp ?? new Date().toISOString();
  const smtpStatusCode = event.payload?.delivery?.smtpStatusCode ?? null;
  const smtpResponse =
    event.payload?.delivery?.smtpResponse ?? event.payload?.bounce?.reason ?? null;
  const errorCode = ['bounced', 'failed', 'rejected', 'complained'].includes(status)
    ? status.toUpperCase()
    : null;
  const inquiry = await env.CONTACT_DB.prepare('SELECT id FROM inquiries WHERE message_id = ?')
    .bind(messageId)
    .first();
  // Email events can arrive before the send response has been saved.
  if (!inquiry) {
    if (message.attempts <= 5) message.retry({ delaySeconds: 60 });
    else message.ack();
    return;
  }
  const result = await env.CONTACT_DB.prepare(
    `UPDATE inquiries SET status = ?, delivery_event = ?, delivered_at = CASE WHEN ? = 'delivered' THEN ? ELSE delivered_at END,
     sent_at = CASE WHEN ? = 'delivered' THEN ? ELSE sent_at END, updated_at = ?, smtp_status_code = ?, smtp_response = ?,
     last_error_code = ?, last_error_message = ? WHERE message_id = ? AND (delivery_event IS NULL OR updated_at <= ?)`,
  )
    .bind(
      status,
      event.type,
      status,
      occurredAt,
      status,
      occurredAt,
      occurredAt,
      smtpStatusCode,
      smtpResponse,
      errorCode,
      errorCode ? smtpResponse : null,
      messageId,
      occurredAt,
    )
    .run();
  console.log(
    JSON.stringify({
      message: 'contact delivery event recorded',
      messageId,
      status,
      matched: result.meta.changes,
      smtpStatusCode,
    }),
  );
  message.ack();
}
async function recoverStalledInquiries(env: Env): Promise<void> {
  const cutoff = new Date(Date.now() - 15 * 60_000).toISOString();
  const rows = await env.CONTACT_DB.prepare(
    `SELECT id FROM inquiries WHERE status IN ('pending', 'queue_failed')
     OR (status IN ('queued', 'sending', 'retrying') AND updated_at < ? AND (next_attempt_at IS NULL OR next_attempt_at < ?))
     ORDER BY created_at ASC LIMIT 50`,
  )
    .bind(cutoff, cutoff)
    .all<{ id: string }>();
  for (const row of rows.results) {
    try {
      await env.CONTACT_QUEUE.send({ inquiryId: row.id } satisfies DeliveryMessage);
      await markQueued(env, row.id);
    } catch (error) {
      const failure = errorDetails(error);
      console.error(
        JSON.stringify({
          message: 'contact inquiry recovery failed',
          inquiryId: row.id,
          errorCode: failure.code,
          error: failure.message,
        }),
      );
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') ?? '';
    if (!isAllowedOrigin(origin, env))
      return Response.json(
        { ok: false, message: 'This form origin is not allowed.' },
        { status: 403 },
      );
    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (request.method !== 'POST')
      return json(origin, { ok: false, message: 'Method not allowed.' }, 405);
    try {
      return await acceptInquiry(request, env, origin);
    } catch (error) {
      console.error(JSON.stringify({ event: 'contact request failed', ...errorDetails(error) }));
      return json(
        origin,
        {
          ok: false,
          message:
            'We could not confirm your inquiry was saved. Please try again with the same details.',
        },
        503,
      );
    }
  },
  async queue(batch: MessageBatch<DeliveryMessage | EmailDeliveryEvent>, env: Env): Promise<void> {
    if (batch.queue === 'lakeland-contact-email-events') {
      for (const message of batch.messages)
        await recordDeliveryEvent(message as Message<EmailDeliveryEvent>, env);
      return;
    }
    for (const message of batch.messages)
      await deliverMessage(message as Message<DeliveryMessage>, env);
  },
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(recoverStalledInquiries(env));
  },
} satisfies ExportedHandler<Env, DeliveryMessage | EmailDeliveryEvent>;
