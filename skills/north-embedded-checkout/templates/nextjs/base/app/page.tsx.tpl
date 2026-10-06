'use client';

import { useState } from 'react';
import { NorthCheckout } from '../components/north/NorthCheckout';

// Starter shop. Prices shown here are for display only; the server prices the
// cart from lib/north/catalog.ts. Swap in your own products and UI.
const PRODUCTS = [
  { sku: 'coffee-beans', name: 'House Coffee Beans (12 oz)', display: '$18.00' },
  { sku: 'cold-brew', name: 'Cold Brew Can', display: '$5.00' },
];

export default function Home() {
  const [qty, setQty] = useState<Record<string, number>>({ 'coffee-beans': 1, 'cold-brew': 0 });
  const items = Object.entries(qty)
    .filter(([, q]) => q > 0)
    .map(([sku, quantity]) => ({ sku, quantity }));

  return (
    <main>
      <h1>North Embedded Checkout starter</h1>
      <p>Pick items, then check out with North&apos;s hosted payment form.</p>
      <ul>
        {PRODUCTS.map((p) => (
          <li key={p.sku}>
            <label>
              {p.name} · {p.display}{' '}
              <input
                type="number"
                min={0}
                max={20}
                value={qty[p.sku] ?? 0}
                onChange={(e) => setQty({ ...qty, [p.sku]: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
              />
            </label>
          </li>
        ))}
      </ul>
      <NorthCheckout items={items} />
    </main>
  );
}
