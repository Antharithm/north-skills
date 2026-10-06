---
name: north-embedded-checkout
description: Build, add, or change payments with North Embedded Checkout (North's hosted payment form). Use when the user wants to take card payments, add a checkout to a Next.js / Express / Node app, create a North checkout session, mount the hosted form, verify a payment, handle North's transaction webhook, or wire the north-skills starter files into an existing app. Server prices the cart, server verifies, private key never reaches the browser.
version: 0.1.0
license: MIT
compatibility: Writes and edits project code. Reads NORTH_CHECKOUT_PRIVATE_KEY, NORTH_CHECKOUT_ID and NORTH_PROFILE_ID from the project's env file at runtime; never asks for them in chat and never prints them.
metadata:
  author: north-skills (unofficial)
  homepage: https://developer.north.com
allowed-tools: Read Grep Glob Edit Write Bash
---

# North Embedded Checkout

North Embedded Checkout puts North's hosted payment form (an iframe) on your page. Card data is typed into North's iframe and never touches your page or server, which keeps PCI scope small. Your server creates a **session**, the browser **mounts** the form with the session token, and your server **verifies** the outcome with North.

## Behavior

1. **Set up first if North isn't in the project yet.** Look for `lib/north/client.ts` (Next.js; may be under `src/`) or `src/north/client.ts` (Express). If either exists, build on it and never write a second North client. If neither exists, run the setup below before anything else.
2. **Detect the framework** from `package.json` (`next` → Next.js App Router; `express` → Express). For anything else, follow the same flow with that framework's idioms.
3. **Wire into the user's app, don't replace it.** Replace the starter `catalog.ts` with the app's real prices (database, CMS, existing product model). Render `<NorthCheckout items={...} />` (Next.js) or call `northCheckout.start()` (Express) where their cart's checkout button is. Keep their styling.
4. **Check credentials without reading them.** Confirm the three `NORTH_*` names exist in `.env.local` / `.env` (e.g. `grep -c '^NORTH_CHECKOUT_ID=.' .env.local`). Never print the values or ask the user to paste them into chat.
5. **Before you finish, run the invariants checklist below** against every file you touched, run the project's typecheck, and if `@north-doctor` is installed run `node <its-dir>/scripts/doctor.mjs` and fix anything it reports.
6. For questions about North in general (products, accounts, pricing, going live) use `@learn-north`.

## Setup (first run in a project)

This is the second half of `npx skills add`: that command installs the skills; this step writes the code. Ask these as **one short message** (use your question tool if you have one), with the detected answer pre-selected:

1. **Do you have a North developer account with a Sandbox checkout?** "Yes, I have my keys" / "No, I need to sign up". Never assume. If no, give them the steps in "No account yet" below, and scaffold anyway: the code works as soon as the keys arrive.
2. **Which North product?** Embedded Checkout. Payment API, Merchant Boarding API, Recurring Billing API, Business & Merchant Reporting APIs and semi-integrated card-present are **(coming soon)**: say so and stop if they pick one.
3. **New project or this existing one?** Default: existing if the folder has a `package.json`, otherwise new.
4. **Which framework?** Next.js or Express. React Native / Expo and iOS (Swift) are **(coming soon)**. For an existing project, detect it first: `node <skill-dir>/scripts/scaffold.mjs --detect`.
5. **Project folder name** (new projects only). Default `north-checkout-app`.

Then run the scaffold script that ships next to this file (`<skill-dir>` is the folder containing this SKILL.md, e.g. `.claude/skills/north-embedded-checkout` or `.agents/skills/north-embedded-checkout`):

```bash
node <skill-dir>/scripts/scaffold.mjs --framework nextjs --mode new --name my-shop
node <skill-dir>/scripts/scaffold.mjs --framework express --mode existing --dir .
```

It never overwrites files and never touches secret values. Show the user what it wrote, then do its "Next" steps with them: `npm install`, ask them to paste their Sandbox keys into `.env.local` / `.env` themselves, then `npm run dev`. For an existing project, continue with steps 3-5 below to wire it in.

### No account yet

Give these as clickable links, in order:

1. **Sign up (free):** https://developer.north.com/register. No business paperwork needed for Sandbox.
2. **Create a checkout** in the Form Designer: https://developer.north.com/dashboard/embedded-checkouts/designer. Name it, style it, set **Domain** to the exact origin your page runs on (a tunnel URL such as ngrok works for local development), and click **Save Checkout**.
3. **Get the keys:** open the checkout from https://developer.north.com/dashboard/embedded-checkouts and copy its private key, checkout ID and profile ID into `.env.local` (Next.js) or `.env` (Express). The user pastes them into the file themselves, never into chat.

Already have an account: https://developer.north.com/login → https://developer.north.com/dashboard/embedded-checkouts.

Docs: Form integration guide https://developer.north.com/products/online/embedded-checkout/form-integration-guide

## The flow

```
browser ── POST /api/north/session {items:[{sku,quantity}]} ──▶ your server
your server ── POST https://checkout.north.com/api/sessions (Bearer private key) ──▶ North
your server ◀── { token }  (JWT, 30 min, one payment attempt)
browser ◀── { token, amountCents }
browser: checkout.onPaymentComplete(cb); checkout.mount(token, 'north-checkout')
customer pays inside North's iframe → cb fires (UI hint only) → /checkout/confirm
browser ── POST /api/north/verify {token} ──▶ your server
your server ── GET https://checkout.north.com/api/sessions/status ──▶ North   ← source of truth
North ── POST <webhook base>/transaction (HMAC-signed) ──▶ your server       ← second confirmation
```

## Invariants (never break these)

| # | Rule | Why |
|---|------|-----|
| 1 | Private key only on the server. Never in `NEXT_PUBLIC_*`, `EXPO_PUBLIC_*`, client components, mobile bundles, or the repo. | Anyone holding it can create sessions and forge webhook signatures. |
| 2 | The server prices the cart. The browser sends only `{ sku, quantity }`. | A client-sent price is a customer-chosen price. |
| 3 | Integer cents internally. Convert to dollars only at the North boundary: `amountCents / 100`. `products[].price` is the **unit** price in dollars; `amount` must equal the products total. | Float addition drifts; North rejects mismatched totals. |
| 4 | Paid = status `Approved` **and** `auth_resp === "00"` (when present) **and** `auth_amount` equals the charged amount (when present). | Partial approvals return `Approved` with a lower amount. |
| 5 | `onPaymentComplete` is a UI hint. Only the server's status call (or a verified webhook) marks an order paid. | Browser callbacks can be faked, blocked, or never fire. |
| 6 | Session status is a server-to-server call. North rejects requests with an `Origin` header. | It needs the private key; browsers always send Origin. |
| 7 | Every server → North request sends `User-Agent` containing `Embedded Checkout`. | Required by North's integration guide; Node's default UA fails it. |
| 8 | Webhook: verify `X-YourApp-Signature-256` HMAC-SHA256 keyed with the **checkout private key** over the **raw** body bytes, check `X-YourApp-Timestamp`, constant-time compare, dedupe, return 200 fast. | Parsing first changes the bytes; the `sec_` signup secret is a different scheme. |
| 9 | One session per payment attempt. Never reuse a token after 30 min or after a decline. | Tokens are single-attempt JWTs. |
| 10 | Only accept verify requests for tokens your server created. | Stops probing with arbitrary tokens. |

## Common tasks → where to look

| Task | Reference |
|------|-----------|
| Endpoints, headers, bodies, statuses, receipt fields | `references/Api.md` |
| `checkout.js`, mount, callbacks, Domain field, iframe | `references/Frontend.md` |
| Transaction webhook signature, dedupe, allowlisting | `references/Webhooks.md` |
| File layout, adding to an existing app, mobile (WebView) | `references/Architecture.md` |
| Something's broken | `@north-doctor` (runs the checks), then `references/CommonPitfalls.md` |
| Sandbox, test cards, going live | `references/Testing.md` |

## Not covered (yet)

North's other products are coming soon to these skills: Payment API, Merchant Boarding API, Recurring Billing API, Business & Merchant Reporting APIs, semi-integrated card-present. If asked, answer from `@learn-north` and point to developer.north.com. Do not invent endpoints for them.
