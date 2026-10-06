# North concepts for Stripe developers

| You know (Stripe) | North equivalent |
|-------------------|------------------|
| Secret key `sk_...` on your server | Checkout **private key** (per checkout), server only |
| Checkout Session / PaymentIntent `client_secret` sent to the browser | Session **token** from `POST /api/sessions` (JWT, 30 min, one attempt) |
| Stripe.js + Payment Element / Embedded Checkout | `checkout.js` + `checkout.mount(token, containerId)` |
| Dashboard Checkout branding | **Checkout Designer** (theme, logo, fields, Domain, webhook URL) |
| Retrieve the session/intent server-side to confirm | `GET /api/sessions/status`: `Approved` + `auth_resp` `00` + amount |
| Webhook signature with `whsec_` | HMAC-SHA256 with the **checkout private key** over raw bytes (`X-YourApp-Signature-256`) |
| Connect (platform vs direct) | The MID application's "how will you get paid?" choice |
| Test mode keys | Sandbox credentials from Checkout Designer |

Same trust model on both: server creates the session, browser renders the provider's form, server verifies, webhook confirms.

Differences to know:
- Session status rejects requests with an `Origin` header (server-only by design).
- Every server call needs a `User-Agent` containing `Embedded Checkout`.
- Webhook URLs must be allowlisted by North.
- Don't quote North pricing as fact; fees come with the merchant application.
