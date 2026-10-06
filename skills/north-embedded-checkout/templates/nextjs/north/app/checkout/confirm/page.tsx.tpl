'use client';

import Link from 'next/link';
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

  // Class names match the starter's globals.css; restyle freely.
  if (error) return <Result tone="bad" icon="!" title="Checkout" detail={error} />;
  if (!result) return <Result tone="wait" icon="…" title="Confirming your payment" detail="Checking with North…" />;
  const title = result.paid ? 'Payment confirmed' : result.orderStatus === 'review' ? 'Payment needs review' : 'Payment declined';
  const detail = `Order ${result.orderId} · North status: ${result.status}${result.reason ? ` · ${result.reason}` : ''}`;
  return <Result tone={result.paid ? 'ok' : 'bad'} icon={result.paid ? '✓' : '!'} title={title} detail={detail} />;
}

function Result({ tone, icon, title, detail }: { tone: 'ok' | 'bad' | 'wait'; icon: string; title: string; detail: string }) {
  return (
    <main className="card result">
      <div className={`result-icon${tone === 'bad' ? ' bad' : ''}`} aria-hidden>
        {icon}
      </div>
      <h1>{title}</h1>
      <p className="muted" role={tone === 'bad' ? 'alert' : undefined}>
        {detail}
      </p>
      {tone !== 'wait' && <Link href="/">Back to the store</Link>}
    </main>
  );
}
