'use client';

import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

// Browser side of North Embedded Checkout. UI glue only: nothing here is trusted
// by the server. Card details are typed inside North's iframe and never touch
// this page or your server, which is what keeps your PCI scope small.
//
// Flow: POST { items } to /api/north/session -> { token } -> checkout.mount()
//       -> onPaymentComplete -> /checkout/confirm, which asks the server to verify.

export interface CartItem {
  sku: string;
  quantity: number;
}

const CONTAINER_ID = 'north-checkout';
export const TOKEN_KEY = 'northSessionToken';

export function NorthCheckout({ items, confirmPath = '/checkout/confirm' }: { items: CartItem[]; confirmPath?: string }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<'idle' | 'loading' | 'mounted'>('idle');
  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    const checkout = window.checkout;
    if (!checkout) return setError('North checkout.js has not loaded yet.');
    if (items.length === 0) return setError('Add at least one item.');
    setState('loading');

    // 1. Ask OUR server for a session. Only SKU + quantity leave the browser.
    let session: { token: string; amountCents: number };
    try {
      const res = await fetch('/api/north/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      session = data;
    } catch (err) {
      setState('idle');
      return setError(`Could not start checkout: ${(err as Error).message}`);
    }
    setAmountCents(session.amountCents);

    // 2. Register the completion callback BEFORE mounting so the event cannot be missed.
    const unsubscribe = checkout.onPaymentComplete(() => {
      unsubscribe();
      sessionStorage.setItem(TOKEN_KEY, session.token);
      router.push(confirmPath);
    });

    // 3. Render North's hosted form. If this hangs, check the Domain field in
    //    Checkout Designer matches this page's origin.
    setState('mounted');
    try {
      await checkout.mount(session.token, CONTAINER_ID);
    } catch (err) {
      setError(`Could not load the payment form: ${(err as Error).message ?? err}`);
    }
  }

  return (
    <div>
      <Script src="https://checkout.north.com/checkout.js" strategy="afterInteractive" onReady={() => setReady(true)} />
      {state !== 'mounted' && (
        <button type="button" onClick={start} disabled={!ready || state === 'loading'}>
          {state === 'loading' ? 'Starting…' : 'Checkout'}
        </button>
      )}
      {amountCents !== null && <p>Total: ${(amountCents / 100).toFixed(2)}</p>}
      {error && <p role="alert">{error}</p>}
      <div id={CONTAINER_ID} />
    </div>
  );
}
