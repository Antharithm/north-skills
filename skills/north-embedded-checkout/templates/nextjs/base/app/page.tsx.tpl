'use client';

import { useState } from 'react';
import { NorthCheckout } from '../components/north/NorthCheckout';

// Starter store. Prices here are for DISPLAY only: the server prices the cart from
// lib/north/catalog.ts and never trusts these numbers. Swap in your own products.
const PRODUCTS = [
  { sku: 'coffee-beans', name: 'House Coffee Beans', detail: '12 oz bag · whole bean', priceCents: 1800, emoji: '☕' },
  { sku: 'cold-brew', name: 'Cold Brew Can', detail: '8 oz · ready to drink', priceCents: 500, emoji: '🥫' },
];
const MAX = 20;
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default function Home() {
  const [qty, setQty] = useState<Record<string, number>>({ 'coffee-beans': 1, 'cold-brew': 0 });
  // While North's form is showing, the cart is locked: the session was created for this exact total.
  const [checkingOut, setCheckingOut] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const editCart = () => {
    setCheckingOut(false);
    setAttempt((a) => a + 1); // remounts NorthCheckout; the next Checkout creates a new session
  };
  const set = (sku: string, n: number) => setQty({ ...qty, [sku]: Math.min(MAX, Math.max(0, n)) });

  const items = PRODUCTS.filter((p) => (qty[p.sku] ?? 0) > 0).map((p) => ({ sku: p.sku, quantity: qty[p.sku] }));
  const lines = PRODUCTS.filter((p) => (qty[p.sku] ?? 0) > 0);
  const subtotal = lines.reduce((sum, p) => sum + p.priceCents * qty[p.sku], 0);

  return (
    <main className={`shop${checkingOut ? ' checking-out' : ''}`}>
      <header className="shop-header">
        <span className="badge">Sandbox</span>
        <h1>Starter Store</h1>
        <p className="muted">North Embedded Checkout · Next.js</p>
      </header>

      <div className="shop-grid">
        <section aria-label="Products" className="products">
          {PRODUCTS.map((p) => (
            <article key={p.sku} className="card product">
              <div className="product-art" aria-hidden>
                {p.emoji}
              </div>
              <div className="product-info">
                <h2>{p.name}</h2>
                <p className="muted">{p.detail}</p>
                <p className="price">{money(p.priceCents)}</p>
              </div>
              <div className="stepper" role="group" aria-label={`Quantity of ${p.name}`}>
                <button type="button" onClick={() => set(p.sku, (qty[p.sku] ?? 0) - 1)} aria-label="Remove one">
                  −
                </button>
                <span aria-live="polite">{qty[p.sku] ?? 0}</span>
                <button type="button" onClick={() => set(p.sku, (qty[p.sku] ?? 0) + 1)} aria-label="Add one">
                  +
                </button>
              </div>
            </article>
          ))}
        </section>

        <aside className="card summary" aria-label="Order summary">
          <div className="summary-head">
            <h2>Order summary</h2>
            {checkingOut && (
              <button type="button" className="link-button" onClick={editCart}>
                Edit cart
              </button>
            )}
          </div>
          {lines.length === 0 ? (
            <p className="muted">Your cart is empty.</p>
          ) : (
            <ul className="lines">
              {lines.map((p) => (
                <li key={p.sku}>
                  <span>
                    {qty[p.sku]} × {p.name}
                  </span>
                  <span>{money(p.priceCents * qty[p.sku])}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="total-row">
            <span>Total</span>
            <strong>{money(subtotal)}</strong>
          </div>
          <NorthCheckout key={attempt} items={items} onMount={() => setCheckingOut(true)} />
          <p className="fine-print">🔒 Card details go straight into North&apos;s secure form. They never touch this site.</p>
        </aside>
      </div>
    </main>
  );
}
