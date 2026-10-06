# North Skills

> Unofficial community project. Not affiliated with or endorsed by North.

Agent Skills for **North** payments, plus a one-command starter. Your AI coding agent learns North's integration rules, and you get a working **Embedded Checkout** integration in a new or existing project.

Works with Claude Code, Cursor, Codex, Gemini CLI, GitHub Copilot, Windsurf, Antigravity, and any agent that supports the [Agent Skills](https://skills.sh/) standard.

## Quick start

```bash
npx skills add Antharithm/north-skills
```

Pick the skills and your agent(s). Then open your agent in the project and run:

```
/north-embedded-checkout
```

The agent asks which product (Embedded Checkout; other North products coming soon), new or existing project, and which framework. Then it writes the integration.

### Or do it all in one terminal prompt

```bash
npx create-north-app
```

```
? What do you want to build with?        › Embedded Checkout
                                           Payment API  (coming soon) …
? Which AI coding agent(s) do you use?   ◉ Claude Code  ◉ Cursor  ◯ Codex …
? New project or existing one?           › New project
? Project folder name:                   north-checkout-app
? Which framework?                       › Next.js   Express   React Native / Expo (coming soon)   iOS Swift (coming soon)
```

Then:

```bash
cd north-checkout-app && npm install
# put Sandbox credentials in .env.local (developer.north.com → Checkout Designer)
npm run dev
```

Both paths write the same code. For an existing project, the installer detects Next.js or Express, finds `app/` or `src/app/`, adds North's files next to yours, and **never overwrites a file**.

### Update

```bash
npx skills update -p -y
```

### Set your credentials

Add your Sandbox credentials to `.env.local` (Next.js) or `.env` (Express). They stay on your server and are never needed in chat:

```bash
NORTH_CHECKOUT_PRIVATE_KEY=
NORTH_CHECKOUT_ID=
NORTH_PROFILE_ID=
```

## Skills

| Skill | Description |
|-------|-------------|
| **north-embedded-checkout** | Build or change North Embedded Checkout: sessions, hosted form, server verification, webhooks. Sets up the project on first run. |
| **learn-north** | Knowledge only: North's products, accounts, Sandbox, merchant applications, payments basics, Stripe-to-North mapping. |
| **north-doctor** | *Coming next.* Diagnoses a broken integration and suggests fixes. |

```
/north-embedded-checkout Add checkout to my cart page
/north-embedded-checkout Why does checkout.mount hang?
/learn-north
/learn-north How is North different from Stripe?
```

> **Tip:** Prefix your prompt with the skill name (e.g. `/north-embedded-checkout`) to load it directly.

## north-embedded-checkout

Ten integration invariants the agent checks every change against:

1. Private key only on the server
2. Server prices the cart; the browser sends `{ sku, quantity }`
3. Integer cents internally; dollars only at North's boundary
4. Paid = `Approved` + `auth_resp "00"` + matching `auth_amount`
5. `onPaymentComplete` is a UI hint, not proof of payment
6. Session status is server-to-server (no `Origin` header)
7. `User-Agent` contains `Embedded Checkout`
8. Webhook HMAC over raw bytes with the checkout key, deduped, 200 fast
9. One session token per payment attempt
10. Verify only tokens your server created

References: API, front end, webhooks, architecture (including mobile WebView), common pitfalls, testing and going live.

### Starter code

| | Next.js | Express |
|-|---------|---------|
| North API client (only file that calls North) | `lib/north/client.ts` | `src/north/client.ts` |
| Paid-in-full check | `lib/north/payment.ts` | `src/north/payment.ts` |
| Webhook verification + dedupe | `lib/north/webhook.ts` | `src/north/webhook.ts` |
| Session / verify / webhook routes | `app/api/north/*`, `app/api/webhooks/north/transaction` | `src/north/router.ts` |
| Hosted form | `components/north/NorthCheckout.tsx` | `public/north-checkout.js` |

## Products

| Product | Status |
|---------|--------|
| Embedded Checkout | ✅ available |
| Payment API | coming soon |
| Merchant Boarding API | coming soon |
| Recurring Billing API | coming soon |
| Business & Merchant Reporting APIs | coming soon |
| Semi-integrated card-present | coming soon |

Frameworks: Next.js ✅ · Express ✅ · React Native / Expo (coming soon) · iOS Swift (coming soon)

## Architecture

- **Zero dependencies:** Node built-ins only.
- **Templates live inside the skill** (`skills/north-embedded-checkout/templates`, stored as `*.tpl` so your TypeScript build never compiles them), so `npx skills add` alone is enough to scaffold.
- **One scaffold script** (`skills/north-embedded-checkout/scripts/scaffold.mjs`) used by both the agent and `create-north-app`.
- **Same agent paths as skills.sh:** `.claude/skills`, `.agents/skills`, `.windsurf/skills`.
- **Tests:** `npm test` runs every installer path; `sh scripts/test-installer.sh --build` also installs, typechecks and builds the generated apps.
- **Roadmap:** see `docs/ROADMAP.md`. Generating endpoint rules from North's OpenAPI specs with a CI drift check comes once the specs are available.

## Documentation

- [North Developer](https://developer.north.com)

## License

MIT
