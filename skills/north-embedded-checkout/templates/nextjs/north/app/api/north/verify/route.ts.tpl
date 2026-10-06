import { getSessionStatus, NorthApiError } from '../../../../lib/north/client';
import { findByToken, settle } from '../../../../lib/north/orders';
import { isPaidInFull, paymentFields } from '../../../../lib/north/payment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/north/verify
 * Body:     { token }
 * Response: { orderId, status, paid, reason? }
 *
 * The browser calls this after North's onPaymentComplete fires. We do not take
 * the browser's word for it: we ask North server to server.
 */
export async function POST(request: Request) {
  const token = ((await request.json().catch(() => null)) as { token?: unknown } | null)?.token;
  if (typeof token !== 'string' || !token) return Response.json({ error: 'token is required' }, { status: 400 });

  // The token must belong to a session WE created. A made-up token gets nothing.
  const order = findByToken(token);
  if (!order) return Response.json({ error: 'unknown session' }, { status: 404 });

  try {
    const { status, body } = await getSessionStatus(token);
    const fields = paymentFields(body);
    const outcome = isPaidInFull(status, fields, order.amountCents);

    // Open/Verified are not final: leave the order pending and let the client retry.
    if (status === 'Approved' || status === 'Declined') settle(order, outcome, 'status-endpoint', fields);

    return Response.json({
      orderId: order.id,
      status,
      orderStatus: order.status,
      paid: order.status === 'paid',
      ...(outcome.paid ? {} : { reason: outcome.reason }),
    });
  } catch (err) {
    if (err instanceof NorthApiError) {
      console.error(`[north] ${err.message}`, JSON.stringify(err.body));
      return Response.json({ error: 'Payment provider error' }, { status: 502 });
    }
    throw err;
  }
}
