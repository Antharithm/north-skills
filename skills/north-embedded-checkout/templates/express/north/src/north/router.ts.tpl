import express, { type Request, type Response } from 'express';
import { CATALOG, MAX_QUANTITY } from './catalog';
import { createSession, getSessionStatus, NorthApiError, type NorthProduct } from './client';
import { isNorthConfigured } from './config';
import { createOrder, findByAuthGuid, findByToken, settle, store } from './orders';
import { isPaidInFull, paymentFields } from './payment';
import { dedupeKey, verifySignature, type TransactionWebhook } from './webhook';

// All North routes in one router: app.use(northRouter).
// Mount it BEFORE any global express.json(): the webhook needs the raw bytes,
// so each route attaches its own body parser.
export const northRouter = express.Router();

/** POST /api/north/session  { items: [{ sku, quantity }] } -> { token, amountCents } */
northRouter.post('/api/north/session', express.json(), async (req: Request, res: Response) => {
  if (!isNorthConfigured()) return void res.status(503).json({ error: 'North is not configured. Fill in .env and restart.' });

  let items: { sku: string; quantity: number }[];
  try {
    items = parseCart(req.body);
  } catch (err) {
    return void res.status(400).json({ error: (err as Error).message });
  }

  const lines = items.map((i) => ({ sku: i.sku, name: CATALOG[i.sku].name, quantity: i.quantity, unitPriceCents: CATALOG[i.sku].priceCents }));
  // Total in integer cents from server-side prices only.
  const amountCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
  const products: NorthProduct[] = lines.map((l) => ({ name: l.name, price: l.unitPriceCents / 100, quantity: l.quantity }));

  try {
    const { token } = await createSession({ amountCents, products });
    createOrder(token, amountCents, lines);
    res.json({ token, amountCents });
  } catch (err) {
    providerError(err, res);
  }
});

/** POST /api/north/verify  { token } -> { orderId, status, orderStatus, paid, reason? }. The source of truth. */
northRouter.post('/api/north/verify', express.json(), async (req: Request, res: Response) => {
  const token = (req.body as { token?: unknown } | undefined)?.token;
  if (typeof token !== 'string' || !token) return void res.status(400).json({ error: 'token is required' });

  // The token must belong to a session WE created.
  const order = findByToken(token);
  if (!order) return void res.status(404).json({ error: 'unknown session' });

  try {
    const { status, body } = await getSessionStatus(token);
    const fields = paymentFields(body);
    const outcome = isPaidInFull(status, fields, order.amountCents);
    // Open/Verified are not final: leave the order pending and let the client retry.
    if (status === 'Approved' || status === 'Declined') settle(order, outcome, 'status-endpoint', fields);
    res.json({ orderId: order.id, status, orderStatus: order.status, paid: order.status === 'paid', ...(outcome.paid ? {} : { reason: outcome.reason }) });
  } catch (err) {
    providerError(err, res);
  }
});

/**
 * POST /api/webhooks/north/transaction - second confirmation from North.
 * Checkout Designer webhook BASE URL: https://<your-host>/api/webhooks/north (North appends /transaction).
 * North must allowlist the URL before it delivers.
 */
northRouter.post('/api/webhooks/north/transaction', express.raw({ type: '*/*', limit: '1mb' }), (req: Request, res: Response) => {
  if (!isNorthConfigured()) return void res.status(503).end();
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

  const verdict = verifySignature(rawBody, { get: (name) => req.get(name) ?? null });
  if (!verdict.ok) {
    console.warn(`[north webhook] rejected: ${verdict.reason}`);
    return void res.status(401).end();
  }

  const key = dedupeKey(rawBody);
  if (store.seenWebhooks.has(key)) return void res.status(200).end();
  store.seenWebhooks.add(key);

  // Acknowledge fast so North does not retry; the rest is post-ack work.
  res.status(200).end();

  let payload: TransactionWebhook;
  try {
    payload = JSON.parse(rawBody.toString('utf8')) as TransactionWebhook;
  } catch {
    return console.error('[north webhook] verified but body is not JSON');
  }
  const fields = paymentFields(payload.transaction?.fullResponse);
  // No session token in the webhook: correlate on the processor's auth_guid.
  const order = fields.authGuid ? findByAuthGuid(fields.authGuid) : undefined;
  if (!order) return console.log(`[north webhook] no order yet for auth_guid=${fields.authGuid ?? '-'}`);
  const status = (payload.transaction?.authResp ?? fields.authResp) === '00' ? 'Approved' : 'Declined';
  settle(order, isPaidInFull(status, fields, order.amountCents), 'webhook', fields);
  console.log(`[north webhook] ${order.id} -> ${order.status}`);
});

function parseCart(body: unknown): { sku: string; quantity: number }[] {
  const items = (body as { items?: unknown } | null)?.items;
  if (!Array.isArray(items) || items.length === 0) throw new Error('items must be a non-empty array');
  return items.map((raw, i) => {
    const { sku, quantity } = (raw ?? {}) as { sku?: unknown; quantity?: unknown };
    if (typeof sku !== 'string' || !(sku in CATALOG)) throw new Error(`items[${i}].sku is not a known product`);
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      throw new Error(`items[${i}].quantity must be an integer from 1 to ${MAX_QUANTITY}`);
    }
    return { sku, quantity };
  });
}

function providerError(err: unknown, res: Response) {
  if (err instanceof NorthApiError) {
    console.error(`[north] ${err.message}`, JSON.stringify(err.body));
    return void res.status(502).json({ error: 'Payment provider error' });
  }
  console.error('[north] unexpected error', err);
  res.status(500).json({ error: 'Internal server error' });
}
