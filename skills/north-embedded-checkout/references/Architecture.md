# File layout

## Next.js (App Router)

```
lib/north/config.ts        only reader of NORTH_* env vars ('server-only')
lib/north/client.ts        only caller of checkout.north.com ('server-only')
lib/north/payment.ts       pure: paymentFields(), isPaidInFull()
lib/north/webhook.ts       verifySignature(), dedupeKey()
lib/north/catalog.ts       server price list  ← replace with your products
lib/north/orders.ts        in-memory store    ← replace with your database
components/north/NorthCheckout.tsx      'use client': session → mount → confirm
components/north/checkout-js.d.ts       types for the global `checkout`
app/api/north/session/route.ts          POST  create session
app/api/north/verify/route.ts           POST  verify with North (source of truth)
app/api/webhooks/north/transaction/route.ts  POST  webhook (second confirmation)
app/checkout/confirm/page.tsx           polls /verify, shows the result
```

If the project uses `src/app`, `lib/` and `components/` live under `src/` too. Route handlers set `export const runtime = 'nodejs'` (they use `node:crypto`) and `dynamic = 'force-dynamic'`. Existing projects need `npm install server-only`.

## Express

```
src/north/{config,client,payment,webhook,catalog,orders}.ts   same jobs as above
src/north/router.ts        northRouter: /api/north/session, /api/north/verify, /api/webhooks/north/transaction
public/north-checkout.js   window.northCheckout.start() / .verify()
```

`app.use(northRouter)` must come **before** any global `express.json()`, or the webhook loses its raw bytes.

## Adding to an existing app

1. Map the user's cart to `{ sku, quantity }[]`. If their products use ids, use those as `sku`.
2. Replace `catalog.ts` with a server-side price lookup from their source of truth. Keep integer cents.
3. Replace `orders.ts` with their order model. Required fields: session token (unique), amount in cents, status (`pending | paid | declined | review`), `auth_guid` (indexed), and a processed-webhook key table with a unique index.
4. Put the checkout component/button where their checkout button is.
5. Point their success page at `/api/north/verify` (or reuse `/checkout/confirm`).
6. Leave Stripe or other providers alone unless asked. Running North side by side behind a flag is a supported pattern.

## Mobile (React Native / Expo / Swift)

Same server; the presentation layer differs. See the "Mobile apps" section of `Frontend.md`. The private key never ships in an app bundle: `EXPO_PUBLIC_*` is inlined at build time and `app.config` `extra` is readable on the device.
