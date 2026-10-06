'use client';

import { useEffect, useState } from 'react';
import { TOKEN_KEY } from '../../../components/north/NorthCheckout';

// Lands here after onPaymentComplete. Asks OUR server, which asks North.
// Open/Verified are not final yet, so poll a few times before giving up.

type Result = { orderId: string; status: string; orderStatus: string; paid: boolean; reason?: string };

export default function ConfirmPage() {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) return setError('No checkout session found.');
    let cancelled = false;

    (async () => {
      for (let attempt = 0; attempt < 5 && !cancelled; attempt++) {
        const res = await fetch('/api/north/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (!res.ok) return setError(data.error ?? `HTTP ${res.status}`);
        if (data.orderStatus !== 'pending') {
          sessionStorage.removeItem(TOKEN_KEY);
          return setResult(data);
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      if (!cancelled) setError('Payment is still processing. Refresh in a moment.');
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <main><h1>Checkout</h1><p role="alert">{error}</p></main>;
  if (!result) return <main><h1>Confirming your payment…</h1></main>;
  return (
    <main>
      <h1>{result.paid ? 'Payment confirmed' : result.orderStatus === 'review' ? 'Payment needs review' : 'Payment declined'}</h1>
      <p>Order {result.orderId} · North status: {result.status}{result.reason ? ` · ${result.reason}` : ''}</p>
    </main>
  );
}
