# {{PROJECT_NAME}}

Express app using **North Embedded Checkout**.

- North skills are installed for your agent: use `/north-embedded-checkout` to build or change payments and `/learn-north` for questions about North.
- All North API calls live in `src/north/client.ts`. Secrets are read only in `src/north/config.ts`.
- Rules: the server prices the cart, the server verifies payment (`/api/north/verify` in `src/north/router.ts`), the webhook is a second confirmation, and the private key never reaches the browser.
