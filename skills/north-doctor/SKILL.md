---
name: north-doctor
description: Diagnose and fix a North Embedded Checkout integration. Use when something is broken or suspicious ("mount hangs", "webhook never arrives", "webhook 401", "session call fails", "order marked paid but money missing"), before going live, or for a security review of North payment code. Runs a static checker over the project, optionally a live Sandbox check, explains each finding with the fix, and drafts a local support report when it can't fix the problem.
version: 0.1.0
license: MIT
compatibility: Reads project source. The optional live check reads NORTH_* values from .env / .env.local to call North's Sandbox, and never prints them. Nothing is sent anywhere except North's own API, and only with the user's consent.
metadata:
  author: north-skills (unofficial)
  homepage: https://developer.north.com
allowed-tools: Read Grep Glob Edit Bash
---

# North Doctor

Finds what's wrong with a North Embedded Checkout integration and says how to fix it. It works on any project (Next.js, Express, React Native / Expo, plain Node), not only ones built from the north-skills starter.

## Behavior

1. **If the user described a symptom**, read `references/Symptoms.md` first. Some causes live in Checkout Designer or with North (Domain, webhook allowlisting) and no code scan will show them, so name those up front.
2. **Run the checker** from the project root. `<skill-dir>` is the folder containing this file, e.g. `.claude/skills/north-doctor` or `.agents/skills/north-doctor`:
   ```bash
   node <skill-dir>/scripts/doctor.mjs --json
   ```
   `--list` prints every check. Exit code 1 means at least one error.
3. **Confirm every finding by reading the line.** The checks are heuristics over source text. Drop false positives and say so in one line ("ND013 in X is a log string, not a request"). Don't silently skip them.
4. **Report**, errors first, at most one short paragraph each: what (file:line), why it matters for money or security, and the fix. Group repeats. If nothing is found, say so and mention what static checks can't see (Designer Domain, allowlisting, Sandbox state).
5. **Offer to fix.** Apply changes only after the user says yes, one finding at a time for anything touching payment logic, then re-run the checker to show it's clean. Follow `@north-embedded-checkout`'s invariants when writing the fix.
6. **Live check, only with explicit consent** ("Can I make a $1.00 Sandbox test session with your credentials? Nothing is charged."):
   ```bash
   node <skill-dir>/scripts/doctor.mjs --live --origin http://localhost:3000
   ```
   It confirms the credentials work and the key matches the checkout, reads the checkout **Domain** from the session token and compares it to `--origin` (the #1 cause of a hanging `mount`), and checks the status endpoint. It never prints secrets. Don't run it against production credentials without the user saying so.
7. **Can't fix it?** Offer a support report: fill `references/SupportReport.md` into `north-support-report.md` in the project root. Remove secrets, tokens, card data, customer emails and full receipts. **Show it to the user. Never send it anywhere**: they decide whether to share it with North.

## Never

- Print, log, or paste the private key, session tokens, or `.env` contents into chat.
- Ask the user to paste credentials into chat.
- Run `--live` without consent, or "fix" a finding you haven't read.
- Weaken a check to make a finding go away (e.g. drop signature verification because it fails).

## Checks

| ID | Severity | Catches |
|----|----------|---------|
| ND001 | error | Private key in a `NEXT_PUBLIC_` / `EXPO_PUBLIC_` / `VITE_` / `REACT_APP_` variable |
| ND002 | error | Client code touching the key or importing server-only North modules |
| ND003 | error | Env file holding the key that isn't gitignored |
| ND004 | warn | Next.js North module without `import 'server-only'` |
| ND010 | error | North request without an `Embedded Checkout` User-Agent |
| ND011 | error | Browser calling North's API directly |
| ND012 | info | Status call without `ProfileId` |
| ND013 | warn | North request without a timeout |
| ND020 | warn | Amount or price read from the request body |
| ND021 | warn | Session amount built with `toFixed()` |
| ND022 | warn | Quantity not checked as a whole number |
| ND030 | error | Paid decided by `status === 'Approved'` alone (partial approvals) |
| ND031 | error | Order marked paid inside `onPaymentComplete` |
| ND032 | warn | `onPaymentComplete` registered after `mount()` |
| ND033 | error | Nothing on the server verifies the payment |
| ND040 | error | Webhook body parsed before HMAC, or global `express.json()` before the webhook route |
| ND041 | warn | Webhook HMAC keyed with a `sec_` / webhook secret instead of the checkout private key |
| ND042 | error | Signature compared with `===` instead of `timingSafeEqual` |
| ND043 | warn | Webhook timestamp not checked |
| ND044 | warn | Webhook handler without dedupe |
| ND045 | info | No webhook handler |
| ND050 | warn | Session token kept in `localStorage` |
| ND051 | error | North code on the Edge runtime |
| ND060 | error | WebView renders inline HTML (null origin → `mount` hangs) |
| ND061 | warn | Session token passed in a URL |

Scripts, tests and fixtures (`scripts/`, `test/`, `*.test.ts`, …) are skipped for behaviour checks because they sign fake webhooks on purpose. They're still checked for leaked secrets.
