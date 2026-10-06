import { CATALOG, MAX_QUANTITY } from '../../../../lib/north/catalog';
import { createSession, NorthApiError, type NorthProduct } from '../../../../lib/north/client';
import { isNorthConfigured } from '../../../../lib/north/config';
import { createOrder } from '../../../../lib/north/orders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/north/session
 * Body:     { items: [{ sku, quantity }] }   - no prices: the browser is never trusted with them
 * Response: { token, amountCents }
 */
export async function POST(request: Request) {
  if (!isNorthConfigured()) {
    return Response.json({ error: 'North is not configured. Fill in .env.local and restart.' }, { status: 503 });
  }

  let items: { sku: string; quantity: number }[];
  try {
    items = parseCart(await request.json());
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }

  const lines = items.map((i) => ({
    sku: i.sku,
    name: CATALOG[i.sku].name,
    quantity: i.quantity,
    unitPriceCents: CATALOG[i.sku].priceCents,
  }));
  // Total in integer cents from server-side prices only.
  const amountCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
  const products: NorthProduct[] = lines.map((l) => ({
    name: l.name,
    price: l.unitPriceCents / 100,
    quantity: l.quantity,
  }));

  try {
    const { token } = await createSession({ amountCents, products });
    // One session = one payment attempt = one pending order.
    createOrder(token, amountCents, lines);
    return Response.json({ token, amountCents });
  } catch (err) {
    if (err instanceof NorthApiError) {
      console.error(`[north] ${err.message}`, JSON.stringify(err.body));
      return Response.json({ error: 'Payment provider error' }, { status: 502 });
    }
    throw err;
  }
}

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
