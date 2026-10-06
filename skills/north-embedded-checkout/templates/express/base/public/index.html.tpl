<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{{PROJECT_NAME}}</title>
  <link rel="stylesheet" href="/style.css" />
</head>
<body>
  <main class="shop">
    <header class="shop-header">
      <span class="badge">Sandbox</span>
      <h1>Starter Store</h1>
      <p class="muted">North Embedded Checkout · Express</p>
    </header>

    <div class="shop-grid">
      <!-- Prices here are for DISPLAY only: the server prices the cart from src/north/catalog.ts. -->
      <section aria-label="Products" class="products" id="products"></section>

      <aside class="card summary" aria-label="Order summary">
        <h2>Order summary</h2>
        <ul class="lines" id="lines"></ul>
        <div class="total-row"><span>Total</span><strong id="subtotal">$0.00</strong></div>
        <div class="north-checkout">
          <button type="button" class="north-pay-button" id="pay">Checkout</button>
          <p class="north-total" id="total" hidden></p>
          <p class="north-error" id="error" role="alert" hidden></p>
          <div id="north-checkout" class="north-form"></div>
        </div>
        <p class="fine-print">🔒 Card details go straight into North's secure form. They never touch this site.</p>
      </aside>
    </div>
  </main>

  <script src="https://checkout.north.com/checkout.js"></script>
  <script src="/north-checkout.js"></script>
  <script>
    const PRODUCTS = [
      { sku: 'coffee-beans', name: 'House Coffee Beans', detail: '12 oz bag · whole bean', priceCents: 1800, emoji: '☕' },
      { sku: 'cold-brew', name: 'Cold Brew Can', detail: '8 oz · ready to drink', priceCents: 500, emoji: '🥫' },
    ];
    const qty = { 'coffee-beans': 1, 'cold-brew': 0 };
    const money = (c) => `$${(c / 100).toFixed(2)}`;
    const esc = (s) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

    document.getElementById('products').innerHTML = PRODUCTS.map((p) => `
      <article class="card product">
        <div class="product-art" aria-hidden="true">${p.emoji}</div>
        <div class="product-info"><h2>${esc(p.name)}</h2><p class="muted">${esc(p.detail)}</p><p class="price">${money(p.priceCents)}</p></div>
        <div class="stepper" role="group" aria-label="Quantity of ${esc(p.name)}">
          <button type="button" data-sku="${p.sku}" data-step="-1" aria-label="Remove one">−</button>
          <span id="q-${p.sku}" aria-live="polite"></span>
          <button type="button" data-sku="${p.sku}" data-step="1" aria-label="Add one">+</button>
        </div>
      </article>`).join('');

    function render() {
      const lines = PRODUCTS.filter((p) => qty[p.sku] > 0);
      for (const p of PRODUCTS) document.getElementById(`q-${p.sku}`).textContent = qty[p.sku];
      document.getElementById('lines').innerHTML = lines.length
        ? lines.map((p) => `<li><span>${qty[p.sku]} × ${esc(p.name)}</span><span>${money(p.priceCents * qty[p.sku])}</span></li>`).join('')
        : '<li>Your cart is empty.</li>';
      document.getElementById('subtotal').textContent = money(lines.reduce((s, p) => s + p.priceCents * qty[p.sku], 0));
      document.getElementById('pay').disabled = lines.length === 0;
    }

    document.getElementById('products').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-sku]');
      if (!b) return;
      qty[b.dataset.sku] = Math.min(20, Math.max(0, qty[b.dataset.sku] + Number(b.dataset.step)));
      render();
    });

    document.getElementById('pay').addEventListener('click', async (e) => {
      const items = PRODUCTS.filter((p) => qty[p.sku] > 0).map((p) => ({ sku: p.sku, quantity: qty[p.sku] }));
      const err = document.getElementById('error');
      err.hidden = true;
      e.target.disabled = true;
      e.target.textContent = 'Starting checkout…';
      try {
        const { amountCents } = await northCheckout.start({ items });
        e.target.hidden = true;
        const total = document.getElementById('total');
        total.innerHTML = `Charging <strong>${money(amountCents)}</strong>`;
        total.hidden = false;
      } catch (error) {
        e.target.disabled = false;
        e.target.textContent = 'Checkout';
        err.textContent = error.message;
        err.hidden = false;
      }
    });

    render();
  </script>
</body>
</html>
