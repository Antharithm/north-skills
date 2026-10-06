<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{{PROJECT_NAME}}</title>
  <style>
    :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
    body { max-width: 640px; margin: 3rem auto; padding: 0 1rem; line-height: 1.5; }
    input[type=number] { width: 4rem; }
    button { padding: .6rem 1.2rem; font-size: 1rem; cursor: pointer; }
  </style>
</head>
<body>
  <h1>North Embedded Checkout starter</h1>
  <p>Pick items, then check out with North's hosted payment form. Prices here are for display; the server prices the cart.</p>
  <ul>
    <li><label>House Coffee Beans (12 oz) · $18.00 <input type="number" min="0" max="20" value="1" data-sku="coffee-beans" /></label></li>
    <li><label>Cold Brew Can · $5.00 <input type="number" min="0" max="20" value="0" data-sku="cold-brew" /></label></li>
  </ul>
  <button id="pay">Checkout</button>
  <p id="total"></p>
  <p id="error" role="alert"></p>
  <div id="north-checkout"></div>

  <script src="https://checkout.north.com/checkout.js"></script>
  <script src="/north-checkout.js"></script>
  <script>
    document.getElementById('pay').addEventListener('click', async (e) => {
      const items = [...document.querySelectorAll('input[data-sku]')]
        .map((i) => ({ sku: i.dataset.sku, quantity: Number(i.value) }))
        .filter((i) => i.quantity > 0);
      e.target.disabled = true;
      try {
        const { amountCents } = await northCheckout.start({ items });
        e.target.hidden = true;
        document.getElementById('total').textContent = `Total: $${(amountCents / 100).toFixed(2)}`;
      } catch (err) {
        e.target.disabled = false;
        document.getElementById('error').textContent = err.message;
      }
    });
  </script>
</body>
</html>
