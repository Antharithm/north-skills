# Sandbox and going live

## Sandbox

1. Create a free account at developer.north.com.
2. In **Checkout Designer**, create a Form checkout. Copy its **private key**, **checkout id**, and **profile id** into the project env file.
3. Leave Domain empty for a first `localhost` run, or set it to your tunnel URL. Once set, it must match.
4. Pay with the Sandbox test cards listed in North's docs. Don't hard-code card numbers in the app.
5. Expect `/verify` to return `Approved` and the order to become `paid`. The webhook needs an allowlisted public URL; until then, test it with the signed-request snippet in `Webhooks.md`.

## What to test

- Happy path: Approved → paid.
- Decline → declined; a new attempt creates a new session.
- Tampered cart (price in the body, unknown sku, quantity 0 / 2.5 / 10_000) → 400.
- Verify with a made-up token → 404.
- Webhook: bad signature → 401; replayed body → no second fulfilment; webhook before `/verify` → order still settles.
- `isPaidInFull` unit tests: Approved + `00` + matching amount → paid; Approved + non-`00` → review; amount mismatch → review.

## Going live

- Apply for a merchant account (MID) from the developer portal. The application is a separate partner-portal account and needs business details (e.g. EIN). Fees are disclosed before you sign.
- Swap Sandbox credentials for production ones (same env names).
- Set Checkout Designer Domain to the production origin.
- Ask North to allowlist the production webhook URL.
- Replace the in-memory store with a database; put the webhook dedupe key behind a unique index.
- Card data stays in North's iframe, which typically keeps you in the lightest PCI self-assessment (SAQ-A); confirm your tier with North. Don't add code that reads card fields.
