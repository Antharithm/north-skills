# Symptom → likely causes

Check the non-code causes first; the scanner can't see them.

| Symptom | Not in code (check first) | In code (doctor checks) |
|---------|---------------------------|-------------------------|
| `mount()` never resolves / blank container | Checkout Designer **Domain** ≠ the page's origin (live check reports it); page opened from `file://` or a WebView with inline HTML | ND060, `checkout.js` not loaded before `mount` |
| Session create fails 401/403 | Private key belongs to a different checkout than `NORTH_CHECKOUT_ID`; Sandbox key used with production ids | ND010 (User-Agent) |
| Session create fails 400 | `amount` ≠ Σ `price × quantity` | ND021, cents sent as dollars |
| Status call rejected | Called from a browser (Origin header) | ND011, missing `SessionToken` / `checkoutId` headers |
| Webhook never arrives | **URL not allowlisted by North**; Designer has the full path instead of the base (North appends `/transaction`); localhost URL | ND045 |
| Webhook always 401 | Wrong key (`sec_` signup secret); clock skew | ND040, ND041, ND043 |
| Same order fulfilled twice | Webhook retries | ND044 |
| Order paid but amount short | Partial approval | ND030 |
| Order marked paid with no money | Browser callback trusted | ND031, ND033 |
| Second attempt fails after a decline | Token reused | ND050; one session per attempt |
| Key appeared in GitHub / bundle | — | ND001, ND002, ND003, ND004. **Rotate the key in Checkout Designer.** |
| Designer theme or logo not showing | Designer changes take a moment to propagate to the hosted form; check the Sandbox form in a private window | — |
