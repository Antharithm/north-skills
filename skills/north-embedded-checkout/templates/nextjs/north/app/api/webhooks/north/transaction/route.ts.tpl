import { after } from 'next/server';
import { isNorthConfigured } from '../../../../../lib/north/config';
import { findByAuthGuid, settle, store } from '../../../../../lib/north/orders';
import { isPaidInFull, paymentFields } from '../../../../../lib/north/payment';
import { dedupeKey, verifySignature, type TransactionWebhook } from '../../../../../lib/north/webhook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/north/transaction
 * In Checkout Designer set the webhook BASE URL to https://<your-host>/api/webhooks/north
 * (North appends /transaction). North must allowlist the URL before it delivers.
 * The webhook is a second confirmation; /api/north/verify already settles the order.
 */
export async function POST(request: Request) {
  if (!isNorthConfigured()) return new Response(null, { status: 503 });

  // Raw bytes, never request.json(): the HMAC is over exactly what North sent.
  const rawBody = Buffer.from(await request.arrayBuffer());
  const verdict = verifySignature(rawBody, request.headers);
  if (!verdict.ok) {
    console.warn(`[north webhook] rejected: ${verdict.reason}`);
    return new Response(null, { status: 401 });
  }

  // Claim the key before answering so two racing deliveries cannot both pass.
  const key = dedupeKey(rawBody);
  if (store.seenWebhooks.has(key)) return new Response(null, { status: 200 });
  store.seenWebhooks.add(key);

  // Acknowledge fast so North does not retry; after() runs once the 200 is sent.
  after(() => {
    let payload: TransactionWebhook;
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as TransactionWebhook;
    } catch {
      console.error('[north webhook] verified but body is not JSON');
      return;
    }
    const fields = paymentFields(payload.transaction?.fullResponse);
    // The webhook carries no session token, so correlate on the processor's auth_guid,
    // which the status endpoint's receipt also returns.
    const order = fields.authGuid ? findByAuthGuid(fields.authGuid) : undefined;
    if (!order) {
      console.log(`[north webhook] no order yet for auth_guid=${fields.authGuid ?? '-'}`);
      return;
    }
    const status = (payload.transaction?.authResp ?? fields.authResp) === '00' ? 'Approved' : 'Declined';
    settle(order, isPaidInFull(status, fields, order.amountCents), 'webhook', fields);
    console.log(`[north webhook] ${order.id} -> ${order.status}`);
  });

  return new Response(null, { status: 200 });
}
