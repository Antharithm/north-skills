# Payments basics for developers

## Why a platform embeds payments

Every card payment carries a processing fee. A platform that sends its customers to a separate payment provider earns nothing on those payments. A platform that **embeds** payments can price processing for its merchants above its own cost and keep the difference. For many vertical-software companies that spread becomes a major revenue line.

## Ways software companies take part (simplest → most involved)

| Model | Example era | What the platform does | Revenue share | Risk |
|-------|-------------|------------------------|---------------|------|
| Referral | Amazon 1995, PayPal 1998 | Hands the customer to a provider | None | None |
| Retail ISO | Shopify 2006 | Embeds boarding forms, still a referral | Small | None |
| Wholesale ISO | MindBody 2010 | One experience, larger share, some underwriting | Larger | Some |
| PayFac | Square 2009 | Master merchant; boards sub-merchants itself | Highest | Highest (underwriting, chargebacks, fraud) |

North's pitch: platforms own the payment UX and the boarding UX inside their product, while North carries underwriting and chargeback/fraud liability.

## Interchange in one line

Card networks charge interchange that varies by card type, merchant category (MCC) and risk. Processors add their margin on top. That's why "what does it cost" depends on the business.

## PCI scope

If card numbers touch your server you carry a heavy PCI burden. Hosted fields and iframes (Embedded Checkout) and semi-integrated terminals keep card data on North's side, so your obligations shrink to a short self-assessment. Never log, proxy or store raw card data.

## Vocabulary

- **ISV:** independent software vendor; the platform building on North.
- **MID:** merchant ID; a merchant account able to take payments.
- **Chargeback:** a cardholder disputes a payment; funds are pulled back pending review.
- **Auth / capture / void / refund:** reserve funds / collect them / cancel before settlement / return after settlement.
- **Card-on-file / tokenization:** store a provider token, not the card, to charge again later.
