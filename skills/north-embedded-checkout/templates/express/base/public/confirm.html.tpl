<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Confirming payment</title>
  <link rel="stylesheet" href="/style.css" />
</head>
<body>
  <main class="card result">
    <div class="result-icon" id="icon" aria-hidden="true">…</div>
    <h1 id="title">Confirming your payment</h1>
    <p class="muted" id="detail">Checking with North…</p>
    <a href="/" id="back" hidden>Back to the store</a>
  </main>
  <script src="/north-checkout.js"></script>
  <script>
    const show = (ok, icon, title, detail) => {
      document.getElementById('icon').textContent = icon;
      document.getElementById('icon').classList.toggle('bad', !ok);
      document.getElementById('title').textContent = title;
      document.getElementById('detail').textContent = detail;
      document.getElementById('back').hidden = false;
    };
    northCheckout.verify().then((r) => {
      const title = r.paid ? 'Payment confirmed' : r.orderStatus === 'review' ? 'Payment needs review' : 'Payment declined';
      show(r.paid, r.paid ? '✓' : '!', title, `Order ${r.orderId} · North status: ${r.status}${r.reason ? ' · ' + r.reason : ''}`);
    }).catch((err) => show(false, '!', 'Checkout', err.message));
  </script>
</body>
</html>
