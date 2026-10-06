# {{PROJECT_NAME}}

Next.js app using **North Embedded Checkout**.

- North skills are installed for your agent: use `/north-embedded-checkout` to build or change payments and `/learn-north` for questions about North.
- All North API calls live in `lib/north/client.ts`. Secrets are read only in `lib/north/config.ts`.
- Rules: the server prices the cart, the server verifies payment (`/api/north/verify`), the webhook is a second confirmation, and the private key never reaches the browser.
