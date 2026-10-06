# Common pitfalls (symptom → cause → fix)

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `mount` never resolves, blank container | Checkout Designer **Domain** doesn't match the page origin, or the page has a `null` origin (inline HTML in a WebView) | Set Domain to the exact origin (a tunnel URL for local dev); load a real HTTPS page in WebViews |
| `checkout is not defined` | `checkout.js` not loaded yet, or loaded on the server | Load it client-side; wait for `onReady` / `load` before calling |
| Session call 4xx mentioning amount | `amount` ≠ Σ `price × quantity`, or cents sent as dollars | Compute in cents, convert once with `/ 100`; `price` is unit price |
| Session/status call rejected for no clear reason | Missing `User-Agent` containing `Embedded Checkout` | Set it explicitly on every server call |
| Status call rejected from a browser | Browser sends `Origin`; North rejects it, and the call needs the private key anyway | Move it to the server |
| Token for the wrong checkout | Private key belongs to a different checkout than `NORTH_CHECKOUT_ID` | Keys are per checkout; use the matching key and id |
| Order marked paid on a partial approval | Only `status === 'Approved'` checked | Use `isPaidInFull` (auth_resp `00` + auth_amount) |
| Webhook never arrives | URL not **allowlisted** by North, or base URL includes `/transaction` | Ask North to allowlist; set the base URL only |
| Webhook always 401 "signature mismatch" | Body parsed before hashing; wrong key (`sec_` signup secret instead of the checkout private key); global `express.json()` mounted first | Hash raw bytes with the checkout private key; mount the router first |
| Webhook 401 "timestamp outside window" | Clock skew, or seconds vs milliseconds | Timestamp is milliseconds; check server clock |
| Duplicate fulfilment | No dedupe, or dedupe claimed after responding | Claim the raw-bytes hash before returning 200 |
| Second attempt fails after a decline | Reusing the old token | New session per attempt |
| Private key in the browser bundle | `NEXT_PUBLIC_` / `EXPO_PUBLIC_` prefix, or a client component imports `lib/north/client` | Server-only env names; `import 'server-only'` in North modules |
| Theme colours in Designer don't show in Sandbox | Known Sandbox behaviour seen in testing: the hosted form served default theme vars | Report to North; don't block on it |
