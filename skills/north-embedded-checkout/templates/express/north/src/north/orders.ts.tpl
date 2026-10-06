import type { PaymentFields } from './payment';

// In-memory order store so the starter runs with zero setup.
// Replace with your database before going live: orders must survive restarts,
// and webhook dedupe keys belong in a unique index.

// review = North said Approved but not for the full amount (partial approval). Do not ship.
export type OrderStatus = 'pending' | 'paid' | 'declined' | 'review';

export interface Order {
  id: string;
  token: string;
  amountCents: number;
  lines: { sku: string; name: string; quantity: number; unitPriceCents: number }[];
  status: OrderStatus;
  confirmedBy: ('status-endpoint' | 'webhook')[];
  payment?: PaymentFields;
  reason?: string;
}

interface Store {
  orders: Map<string, Order>;
  byToken: Map<string, string>;
  byAuthGuid: Map<string, string>;
  seenWebhooks: Set<string>;
}

// globalThis so watch-mode reloads share one store.
const g = globalThis as typeof globalThis & { __northStore?: Store };
export const store: Store = (g.__northStore ??= {
  orders: new Map(),
  byToken: new Map(),
  byAuthGuid: new Map(),
  seenWebhooks: new Set(),
});

export function createOrder(token: string, amountCents: number, lines: Order['lines']): Order {
  const order: Order = {
    id: `ord_${crypto.randomUUID().slice(0, 8)}`,
    token,
    amountCents,
    lines,
    status: 'pending',
    confirmedBy: [],
  };
  store.orders.set(order.id, order);
  store.byToken.set(token, order.id);
  return order;
}

export function findByToken(token: string): Order | undefined {
  const id = store.byToken.get(token);
  return id ? store.orders.get(id) : undefined;
}

export function findByAuthGuid(guid: string): Order | undefined {
  const id = store.byAuthGuid.get(guid);
  return id ? store.orders.get(id) : undefined;
}

export function settle(
  order: Order,
  outcome: { paid: boolean; reason?: string },
  source: 'status-endpoint' | 'webhook',
  fields: PaymentFields
): void {
  // Never downgrade a paid order: a late or duplicate decline must not undo it.
  if (order.status !== 'paid') {
    order.status = outcome.paid ? 'paid' : outcome.reason === 'status_Declined' ? 'declined' : 'review';
    order.reason = outcome.reason;
  }
  if (!order.confirmedBy.includes(source)) order.confirmedBy.push(source);
  order.payment = { ...order.payment, ...fields };
  if (fields.authGuid) store.byAuthGuid.set(fields.authGuid, order.id);
}
