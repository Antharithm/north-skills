# Transaction webhook

North POSTs to `<webhook base URL>/transaction` after a transaction. Set the **base** URL in Checkout Designer (e.g. `https://your-host/api/webhooks/north`); North appends `/transaction`.

**North must allowlist your webhook URL before it delivers.** If nothing arrives in Sandbox, ask North to allowlist the URL before you debug your code. Until then, test the handler with locally signed requests.

## Verify

| Header | Meaning |
|--------|---------|
| `X-YourApp-Signature-256` | HMAC-SHA256 hex, keyed with the **checkout private key** |
| `X-YourApp-Timestamp` | Unix time in **milliseconds** |

1. Read the **raw bytes** (`request.arrayBuffer()` in Next.js; `express.raw()` in Express). Never parse first.
2. Reject if the timestamp is missing, not a number, or more than 5 minutes from now.
3. Compute the HMAC over the raw body. The guide leaves two details open, so accept both: an optional `sha256=` prefix on the header, and a signed string of either `<body>` or `<timestamp>.<body>`.
4. Compare with `crypto.timingSafeEqual` (check lengths first).
5. Failures → `401`, empty body.

Not the same as the **signup** webhook (`X-Webhook-Signature: t=..,v1=..`, keyed with a `sec_` secret). Do not mix them up.

## Process

- **Dedupe** on a SHA-256 of the raw bytes, claimed *before* responding. Retries carry the same bytes; a later event for the same transaction does not, so don't key on `auth_guid` alone.
- **Return 200 fast**, then do the work (`after()` in Next.js; after `res.end()` in Express).
- **Correlate** with `transaction.fullResponse.auth_guid`; the webhook has no session token. If no order matches yet (the webhook beat `/verify`), log it; `/verify` will settle the order.
- **Approved** = `transaction.authResp` (or `fullResponse.auth_resp`) `=== "00"`, plus the same amount check as `/verify`.
- **Never downgrade** a paid order on a late or duplicate decline.

## Payload fields you read

```json
{
  "transaction": { "tranType": "...", "authResp": "00", "fullResponse": { "auth_guid": "...", "auth_amount": "23.00" } },
  "sessionData": { "amount": 23.00, "products": [] },
  "additionalFormFields": {}
}
```

## Test without North

Sign a body with your private key and POST it:

```js
const body = JSON.stringify({ transaction: { authResp: '00', fullResponse: { auth_guid: 'test-guid' } } });
const ts = String(Date.now());
const sig = crypto.createHmac('sha256', process.env.NORTH_CHECKOUT_PRIVATE_KEY).update(body).digest('hex');
await fetch('http://localhost:3000/api/webhooks/north/transaction', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-YourApp-Signature-256': sig, 'X-YourApp-Timestamp': ts },
  body,
});
```
