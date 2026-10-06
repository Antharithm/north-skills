# Getting started with North

## 1. Developer account (free)

Sign up at **developer.north.com**. You get the docs, Postman collections, sample apps, and Sandbox access. No business paperwork is needed to start building.

## 2. Sandbox checkout

1. Open **Checkout Designer** and create a Form checkout.
2. Style it (theme, logo, fields) in the Designer, not in code.
3. Copy the **private key**, **checkout id** and **profile id** into your server env file (`NORTH_CHECKOUT_PRIVATE_KEY`, `NORTH_CHECKOUT_ID`, `NORTH_PROFILE_ID`).
4. **Domain:** leave it empty for a first localhost run, or set it to the exact origin that serves your checkout page. Once set, it must match.
5. **Webhook URL:** set the base URL; North must allowlist it before it delivers.
6. Build with `@north-embedded-checkout`, or run the north-skills installer for a ready starter.

## 3. Applying for a merchant account (MID)

To take real payments you apply for a merchant account from the developer portal.

- **First decide how you'll get paid.** Are *you* the merchant (customers pay your business), or does your software serve *other* merchants who get paid (a platform or marketplace)? These are different setups, like Stripe's direct vs Connect accounts.
- The application is a **separate account** on North's partner portal, not your developer login. Have business details ready (e.g. EIN).
- Fees and processing rates are disclosed to you before you sign the agreement.
- Your developer-portal username doesn't change when you name the business in the application.

## 4. Going live

Production credentials (same env names), production Domain in Checkout Designer, production webhook URL allowlisted, a real database for orders and webhook dedupe. See `@north-embedded-checkout` → `references/Testing.md`.

## Getting help

North pairs integrations with people: sales engineers, integration engineers (through certification), relationship managers. Ask through the developer portal.
