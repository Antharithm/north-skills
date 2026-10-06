# Roadmap

## Done

- `north-embedded-checkout`, `learn-north`, Next.js + Express starters.
- Two install paths, same code: `npx skills add Antharithm/north-skills` (the skill asks the setup questions on first run and runs `scripts/scaffold.mjs`) or `npx create-north-app` (asks everything in the terminal).

## Next: /north-doctor (troubleshoot skill), in this repo

Lives here as `skills/north-doctor` so one install gives build + learn + fix, and it reuses the same references (`CommonPitfalls.md`, the invariants table).

`/north-doctor` (optionally with a symptom: "mount hangs", "webhook 401") makes the agent:
1. Detect framework and locate North code (client, routes, component, env names).
2. Run static checks, each reporting file:line, why it matters, and the fix:
   - private key in a client-readable place (`NEXT_PUBLIC_`, `EXPO_PUBLIC_`, client component import, app bundle)
   - User-Agent without "Embedded Checkout"; status call made from the browser / with Origin
   - price taken from the request body; dollars/cents mixing; quantity not an integer in range
   - paid decided by `status === 'Approved'` alone (no `auth_resp` / `auth_amount`)
   - webhook: parsed before hashing, wrong key (`sec_`), global `express.json()` first, no timestamp check, no dedupe, dedupe after ack, `auth_guid`-only key
   - token reused across attempts; no verify-token ownership check
3. Optional live checks with the user's consent: Sandbox session creation, status call shape.
4. Symptom mode: map the symptom to likely causes (Domain mismatch, allowlisting) before reading code.
5. When it can't fix it: draft a support report (stack, failing check, sanitized error, steps tried), shown to the developer, sent nowhere automatically.

Test fixtures: a deliberately broken copy of each starter; every check must catch its planted bug.

## Then
- React Native / Expo starter (WebView bridge pattern) and an iOS (Swift, WKWebView) starter, which become the iOS video tutorial.
- Payment API, Merchant Boarding, Recurring Billing, Reporting skills as specs become available.
- OpenAPI → generated rules → CI drift check.
