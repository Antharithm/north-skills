// Browser side of North Embedded Checkout. UI glue only: the server trusts none of it.
// Needs <script src="https://checkout.north.com/checkout.js"></script> on the page first.
//
//   northCheckout.start({ items: [{ sku, quantity }], containerId: 'north-checkout' })
//
// Flow: POST { items } -> /api/north/session -> { token } -> checkout.mount()
//       -> onPaymentComplete -> /confirm.html, which asks the server to verify.

window.northCheckout = {
  async start({ items, containerId = 'north-checkout', confirmUrl = '/confirm.html' }) {
    if (!window.checkout) throw new Error('North checkout.js has not loaded.');

    // 1. Ask OUR server for a session. Only SKU + quantity leave the browser.
    const res = await fetch('/api/north/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    const session = await res.json();
    if (!res.ok) throw new Error(session.error || `HTTP ${res.status}`);

    // 2. Register the completion callback BEFORE mounting so the event cannot be missed.
    const unsubscribe = window.checkout.onPaymentComplete(() => {
      unsubscribe();
      sessionStorage.setItem('northSessionToken', session.token);
      window.location.assign(confirmUrl);
    });

    // 3. Render North's hosted form. If this hangs, check Checkout Designer's Domain matches this origin.
    await window.checkout.mount(session.token, containerId);
    return session; // { token, amountCents }
  },

  /** Ask the server (which asks North) whether the payment went through. Polls while not final. */
  async verify() {
    const token = sessionStorage.getItem('northSessionToken');
    if (!token) throw new Error('No checkout session found.');
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await fetch('/api/north/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (data.orderStatus !== 'pending') {
        sessionStorage.removeItem('northSessionToken');
        return data;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    throw new Error('Payment is still processing. Refresh in a moment.');
  },
};
