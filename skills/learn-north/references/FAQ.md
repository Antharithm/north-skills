# FAQ

**Is it free to start?** Yes. A developer account and Sandbox cost nothing. Processing fees apply once you have a live merchant account.

**Do card numbers touch my server?** Not with Embedded Checkout. They're typed into North's iframe.

**Can I use it in a mobile app?** Yes, through a WebView loading a hosted HTTPS page on your Checkout Designer Domain. The app gets the session token from your server. See `@north-embedded-checkout`.

**Does `onPaymentComplete` mean I got paid?** No. It's a browser event. Your server must call the session status endpoint (or receive a verified webhook) before fulfilling.

**Why doesn't my webhook arrive?** North must allowlist the URL first, and the Designer field takes the base URL (North appends `/transaction`).

**Why does `mount` hang?** Usually the Designer Domain doesn't match the page's origin.

**Which languages are supported?** The APIs are plain HTTPS + JSON, so any server language works. These skills ship Next.js and Express starters; React Native/Expo and Swift starters are coming soon.

**What does it cost?** Pricing isn't covered here. Fees and rates are disclosed during the merchant application, before you sign.

**Is there a test card?** Yes, in Sandbox: `4111 1111 1111 1111` (Visa) or `3700 000000 00002` (Amex), any future expiry (e.g. 12/30), any CVV (123; 4 digits for Amex), any 5-digit ZIP. Sandbox payments are mock requests; nothing is charged.

**Apple Pay?** Supported on most North integrations; enable and test it per North's docs.

**Is there an MCP server?** Not covered here. These skills give your agent North's integration rules today.
