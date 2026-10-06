---
name: learn-north
description: Learn about North (payments) and building with its APIs. Invoked without a question, gives a friendly tour of North's developer platform, its products, and how to get started. Invoked with a question, answers it directly. Use for "what is North", "can North do X", "which North API should I use", accounts and sandbox, going live, merchant applications (MID), PCI, how North compares to other payment providers, or any exploratory payments question. Routes to @north-embedded-checkout for building.
version: 0.1.0
license: MIT
compatibility: Knowledge-only skill. Read/Grep/Glob access to bundled reference files. Does not require or access any API keys or environment variables.
metadata:
  author: north-skills (unofficial)
  homepage: https://developer.north.com
allowed-tools: Read Grep Glob
---

# Learn North

## Behavior

**If the user invokes `/learn-north` with no question** (or just says "learn north"), give a friendly platform tour:

1. What North is: a payments company whose developer platform (North Developer, developer.north.com) lets software companies embed payments and merchant onboarding in their own product.
2. What they can build today with these skills: **Embedded Checkout** via `@north-embedded-checkout`.
3. What else North offers (skills coming soon): Payment API, Merchant Boarding API, Recurring Billing API, Business & Merchant Reporting APIs, semi-integrated card-present.
4. How to start: free account at https://developer.north.com/register → create a checkout in the Form Designer (https://developer.north.com/dashboard/embedded-checkouts/designer) → Sandbox credentials in `.env.local` → `/north-embedded-checkout`. Already have an account? https://developer.north.com/login

Keep it conversational, an onboarding tour rather than a docs dump. End by asking what they want to build.

**If invoked with a question**, answer it directly from the knowledge below and the references, then route to the right skill. If the answer isn't here, say so and point to developer.north.com or North's team. **Never invent endpoints, prices, limits, or coverage.**

## North in one minute

- **Who it serves:** software companies (ISVs, SaaS platforms, marketplaces, app builders) that want payments inside their product, plus the merchants who use that software.
- **Developer portal:** North Developer. Free sign-up gives API docs, Postman collections for every API, and full open-source sample apps per product (clone, run in Sandbox).
- **Human support:** sales engineers (solution design), integration engineers (kickoff through certification), relationship managers (production and first merchants).
- **Why embed payments:** a platform that processes its customers' payments can earn on each transaction instead of referring the customer to a separate provider. See `references/PaymentsBasics.md`.

## Products

| Product | What it does | Skill |
|---------|--------------|-------|
| **Embedded Checkout** | Hosted payment form (iframe) on your web page or app; card data never touches your server. North's flagship for online payments. | `@north-embedded-checkout` |
| Payment API | Card-not-present payments from your own server/app for e-commerce, marketplaces and online stores; returns a reusable token for void, refund, card-on-file, recurring. | (coming soon) |
| Merchant Boarding API | Onboard merchants to North digitally from inside your own UI. | (coming soon) |
| Recurring Billing API | Scheduled and installment payments; lets a platform build its own buy-now-pay-later. | (coming soon) |
| Business & Merchant Reporting APIs | Portfolio-wide transaction, dispute and store data for dashboards. | (coming soon) |
| Semi-integrated card-present | In-person payments on PAX and Ingenico terminals; card data stays off your server. | (coming soon) |

Alternative payment methods: Apple Pay is supported on most North integrations; Tap to Pay on iPhone is offered through PayAnywhere, North's point-of-sale company.

## Routing

| User need | Route to |
|-----------|----------|
| Take card payments on a website or web app | `@north-embedded-checkout` |
| Add North checkout to an existing Next.js / Express app | `@north-embedded-checkout` |
| Take payments in a mobile app | `@north-embedded-checkout` (WebView pattern in its `Architecture.md`) |
| Verify a payment, handle webhooks | `@north-embedded-checkout` |
| Something is broken, or review before going live | `@north-doctor` |
| Board merchants, recurring billing, reporting, terminals | developer.north.com (skills coming soon) |
| Accounts, Sandbox, going live, MID application | `references/GettingStarted.md` |
| Payments vocabulary (ISV, PayFac, interchange, PCI) | `references/PaymentsBasics.md` |
| North vs Stripe and others | `references/Comparison.md` |

## References

- `references/GettingStarted.md`: account, Sandbox, Checkout Designer, applying for a merchant account, going live
- `references/PaymentsBasics.md`: how embedded payments make money; ISO vs PayFac; PCI scope
- `references/Comparison.md`: concepts mapped to Stripe so Stripe developers can translate
- `references/FAQ.md`: short answers to common questions
