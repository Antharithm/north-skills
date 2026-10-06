# North Embedded Checkout API (server side)

Base URL: `https://checkout.north.com`. Sandbox and production use the same host; the credentials decide which.

## Headers on every server → North call

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer <NORTH_CHECKOUT_PRIVATE_KEY>` |
| `Content-Type` | `application/json` |
| `Accept-Language` | `en` |
| `User-Agent` | must contain `Embedded Checkout`, e.g. `my-app/1.0 (Embedded Checkout; Node.js)` |

Keys are per checkout: North issues a token for whichever checkout the private key belongs to.

## POST /api/sessions: create a session

```json
{
  "checkoutId": "<NORTH_CHECKOUT_ID>",
  "profileId": "<NORTH_PROFILE_ID>",
  "amount": 23.00,
  "products": [
    { "name": "House Coffee Beans (12 oz)", "price": 18.00, "quantity": 1 },
    { "name": "Cold Brew Can", "price": 5.00, "quantity": 1 }
  ]
}
```

- `amount` in **dollars**. Must equal Σ `price × quantity` when `products` is sent.
- `products[].price` is the **unit** price in dollars. Optional `logoUrl` per product.
- Response: `{ "token": "<JWT>", ... }`. Forward only `token` to the browser. Valid 30 minutes, one payment attempt.

## GET /api/sessions/status: what actually happened

Extra headers: `SessionToken: <token>`, `checkoutId: <NORTH_CHECKOUT_ID>`, `ProfileId: <NORTH_PROFILE_ID>` (the docs list only checkoutId; North's official sample also sends ProfileId, so send both).

No `Origin` header: North rejects it, so call this from your server only.

Response: `{ "status": "Open" | "Verified" | "Approved" | "Declined", "body": { ...receipt } }`

- `Open` / `Verified`: not final. Leave the order pending and poll again.
- `Approved`: check the receipt before marking paid (below).
- `Declined`: final. A new attempt needs a new session.
- Any other value: throw. Never treat an unknown answer as "unpaid".

### Receipt (`body`) fields you use

The raw processor response, lowercase keys. The transaction webhook's `transaction.fullResponse` has the same shape.

| Field | Meaning |
|-------|---------|
| `auth_resp` | `"00"` = approved in full. Anything else (e.g. partial approval) = do not ship. |
| `auth_amount` | Approved amount in dollars. Compare to what you charged. |
| `auth_guid` | Processor transaction id. Use it to match webhooks to orders. |
| `auth_code` | Authorization code. |
| `auth_masked_account_nbr` | Masked card number; last 4 for receipts. |

Never forward the raw receipt to the browser.

## Timeouts and errors

- Use a 10 s timeout per request with a fresh `AbortSignal.timeout()` each call (a fired signal cannot be reused on retry).
- Read the body as text, then try JSON: North's error bodies are not always JSON.
- On a North error, log the detail server-side and return a generic `502 Payment provider error` to the client.
