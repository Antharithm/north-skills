# North support report (template)

Fill this into `north-support-report.md` in the project root. Show it to the developer. **Never send it automatically.**

**Where the user can send it** (they send it, you never do): the developer contact form at https://developer.north.com/contact, or Tech Support at technicalsupport@north.com (866.485.8999 ext 1200, 24/7).

Remove before showing: private keys, session tokens, `.env` contents, full card numbers, customer names/emails, full processor receipts. Keep: HTTP status codes, North's error messages, check IDs, file paths.

```markdown
# North Embedded Checkout – support report

**Date:** <YYYY-MM-DD>
**Environment:** Sandbox | Production
**Stack:** <framework + version, runtime (Node x / Edge), hosting>
**Checkout:** <checkout name, not the key>

## Problem
<one or two sentences in the developer's words>

## Expected vs actual
- Expected: <…>
- Actual: <…>

## Steps to reproduce
1. <…>

## Diagnostics
- north-doctor findings: <IDs and one-line titles, or "none">
- Live check: <credentials ok / session HTTP status / Domain claim vs page origin / status call result>
- North error response (redacted): <status + message>

## Already tried
- <…>

## Questions for North
- <e.g. "Is https://example.com/api/webhooks/north allowlisted for this checkout?">
```
