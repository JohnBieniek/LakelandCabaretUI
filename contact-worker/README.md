# Lakeland contact form

The Angular form posts to `https://lakeland-contact-form.johnbieniekgt.workers.dev`.
It requires `desiredDate` (a real `YYYY-MM-DD` date), `service`, `name`, `email`,
and `details`. Both browser and server validate the required fields. The hidden
`website` field must remain empty; `submissionId` is a client-generated UUID.

Inquiries go to **Contact@LakelandCabaret.com**, from
`contact-form@experiencewhimsy.com` with the display name **Lakeland Cabaret Website**.
The visitor's email is the reply-to address. The destination must be verified in
Cloudflare Email Routing before this existing Whimsy sending setup can deliver.
Cloudflare sent the verification email on September 19, 2026.

## Delivery and retry behavior

This follows the neighboring Whimsy contact worker:

- Save to D1 before returning success and a reference number.
- Deliver asynchronously with Cloudflare Queues.
- Retry temporary failures after **1, 5, 15, and 60 minutes** (five send attempts).
- Run recovery every five minutes for inquiries stranded before or during queueing.
- Keep terminal failures in D1 and the dead-letter queue for investigation.
- Reuse a submission ID for unchanged browser retries. A unique database constraint
  also prevents concurrent requests from storing duplicate inquiries.

The retry count and next attempt time are stored in D1, so recovery cannot restart
the retry budget. A delivery lease prevents overlapping consumers from sending the
same inquiry. As with Whimsy, an email accepted by the provider followed by a
database outage can still produce a duplicate; delivery is not exactly-once.

The browser preserves fields on failure or timeout, disables repeat clicks while
sending, and clears the form only after the server confirms durable storage.
Saved inquiries whose queue is temporarily unavailable show a delivery-delay notice.
The success message confirms storage, not inbox delivery.

## Develop and verify

Use the Node version specified by the root `.node-version`.

```sh
npm ci --prefix contact-worker
npm run check --prefix contact-worker
npm test --prefix contact-worker
npm run test:content
npm test -- --watch=false
npm run build
```

The worker tests use SQLite and mocked email/queue bindings to exercise validation,
concurrent submissions, storage/queue outages, email content, retry intervals,
terminal failures, recovery, and delivery events without sending mail.

For local worker development:

```sh
cd contact-worker
npx wrangler d1 migrations apply lakeland-contact-inquiries --local
npm run dev
```

The Angular form uses the deployed endpoint, including from `http://localhost:4200`.
To test only local delivery, post the same JSON contract to the local worker URL;
local email bindings simulate sending unless explicitly configured as remote.

## Deploy

The Pages dev project `lakelandcabaretui-dev` builds the Git **develop** branch.
The worker is deployed separately; pushing Pages alone does not update its code.

```sh
cd contact-worker
npx wrangler d1 migrations apply lakeland-contact-inquiries --remote
npm run deploy
```

`wrangler.jsonc` records the provisioned database and queue names. No API keys are
stored in the repository. Keep the email binding restriction and `TO_ADDRESS`
in sync when changing the inbox, and verify the replacement destination first.

## Inspect failures and retry after fixing configuration

```sh
npx wrangler d1 execute lakeland-contact-inquiries --remote --command "SELECT reference, status, delivery_attempts, last_error_code FROM inquiries ORDER BY created_at DESC LIMIT 20"
```

Permanent failures, such as an unverified destination, are not automatically
retried. After fixing the cause, an operator can reset a specific inquiry's
`status` to `pending`, `delivery_attempts` to zero and `next_attempt_at` to NULL;
the recovery job queues it within five minutes. Check that the message was not
already accepted before resetting it.

The `lakeland-contact-email-events` queue and handler support delivery lifecycle
events if the sending domain is later onboarded to Cloudflare Email Sending.
They currently have no event subscription: the existing Whimsy domain uses Email
Routing, whose Worker sends do not publish Email Sending lifecycle events. An
`accepted` status therefore does not prove inbox delivery.
