# Sandbox and going live

## Sandbox

1. Create a free account: https://developer.north.com/register (or log in: https://developer.north.com/login).
2. Create a Form checkout in the Form Designer: https://developer.north.com/dashboard/embedded-checkouts/designer. Then open it from https://developer.north.com/dashboard/embedded-checkouts and copy its **private key**, **checkout id**, and **profile id** into the project env file.
3. Leave Domain empty for a first `localhost` run, or set it to your tunnel URL. Once set, it must match.
4. Pay with North's Sandbox test cards (from the Form integration guide). Sandbox payments are mock requests; nothing is charged.

   | Card | Brand | Result |
   |------|-------|--------|
   | `4111 1111 1111 1111` | Visa | Successful transaction |
   | `3700 000000 00002` | Amex | Successful transaction |

   Expiry: any future date (e.g. `12/30`). CVV: any 3 digits (e.g. `123`), 4 for Amex. ZIP: any 5 digits (e.g. `12345`). The starter shows this card under the Checkout button; remove that hint before going live.
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
- Swap Sandbox credentials for production ones (same env names), and remove the starter's "Sandbox test card" hint.
- Set Checkout Designer Domain to the production origin.
- Ask North to allowlist the production webhook URL.
- Replace the in-memory store with a database; put the webhook dedupe key behind a unique index.
- Card data stays in North's iframe, which typically keeps you in the lightest PCI self-assessment (SAQ-A); confirm your tier with North. Don't add code that reads card fields.
