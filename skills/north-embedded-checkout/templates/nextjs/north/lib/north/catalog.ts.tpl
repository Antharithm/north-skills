import 'server-only';

// The server's price list. Prices come from HERE, never from the browser:
// the client sends only { sku, quantity }. Replace with your database.

export interface CatalogItem {
  name: string;
  priceCents: number;
}

export const CATALOG: Record<string, CatalogItem> = {
  'coffee-beans': { name: 'House Coffee Beans (12 oz)', priceCents: 1800 },
  'cold-brew': { name: 'Cold Brew Can', priceCents: 500 },
};

export const MAX_QUANTITY = 20;
