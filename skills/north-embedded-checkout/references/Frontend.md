# Browser side: checkout.js

```html
<script src="https://checkout.north.com/checkout.js"></script>
<div id="north-checkout"></div>
```

The script exposes a global `checkout`:

| Call | Notes |
|------|-------|
| `checkout.onPaymentComplete(cb)` | Register **before** `mount` so the event cannot be missed. Returns an unsubscribe function; call it inside `cb` to avoid double-firing. `cb` is a UI hint: navigate to your confirm page and let the server verify. |
| `await checkout.mount(token, containerId)` | Renders the hosted form iframe into the element with that id. |

Next.js: load with `next/script` (`strategy="afterInteractive"`) in a `'use client'` component and wait for `onReady` before enabling the button. The starter's `components/north/NorthCheckout.tsx` does this, and `checkout-js.d.ts` types the global.

## Checkout Designer settings that affect the browser

- **Domain:** the session token carries the Designer's Domain. If set, it must match the origin serving the page, or `mount` hangs with no error. For local development behind a tunnel, use the tunnel URL (e.g. ngrok). `*` is rejected.
- **Theme, logo, fields:** configured in Checkout Designer, not in code.

## Mobile apps

There is no "mount into a native view" call. React Native / iOS / Android apps load a **real hosted HTTPS page** (on the Designer's Domain) in a WebView. The app gets the token from its own server and injects it through the WebView bridge, never in the URL. Inline HTML fails because its origin is `null` and `mount` hangs. The page posts `ready` / `mounted` / `payment-complete` / `error` back to the app; the app then asks its server to verify.
