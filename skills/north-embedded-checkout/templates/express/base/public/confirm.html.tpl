<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Confirming payment</title>
  <style>:root { color-scheme: light dark; font-family: system-ui, sans-serif; } body { max-width: 640px; margin: 3rem auto; padding: 0 1rem; }</style>
</head>
<body>
  <h1 id="title">Confirming your payment…</h1>
  <p id="detail"></p>
  <script src="/north-checkout.js"></script>
  <script>
    northCheckout.verify().then((r) => {
      document.getElementById('title').textContent = r.paid ? 'Payment confirmed' : r.orderStatus === 'review' ? 'Payment needs review' : 'Payment declined';
      document.getElementById('detail').textContent = `Order ${r.orderId} · North status: ${r.status}${r.reason ? ' · ' + r.reason : ''}`;
    }).catch((err) => {
      document.getElementById('title').textContent = 'Checkout';
      document.getElementById('detail').textContent = err.message;
    });
  </script>
</body>
</html>
