/* Starter styles (same as the Next.js starter). Light and dark, explicit colours so embedded browsers render it correctly. */
:root {
  --bg: #f6f7f9;
  --surface: #ffffff;
  --text: #14161a;
  --muted: #5f6672;
  --border: #e3e6eb;
  --accent: #0f766e;
  --accent-text: #ffffff;
  --accent-soft: #e6f4f2;
  --danger: #b42318;
  --radius: 14px;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f1115;
    --surface: #171a21;
    --text: #eef0f3;
    --muted: #9aa3b2;
    --border: #2a2f3a;
    --accent: #2dd4bf;
    --accent-text: #06201d;
    --accent-soft: #10302d;
    --danger: #ff8a7a;
    color-scheme: dark;
  }
}

* { box-sizing: border-box; }
html, body { margin: 0; background: var(--bg); color: var(--text); }
body { font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; line-height: 1.5; -webkit-font-smoothing: antialiased; }
h1, h2 { margin: 0; line-height: 1.2; }
p { margin: 0; }
.muted { color: var(--muted); }

.shop { max-width: 980px; margin: 0 auto; padding: 48px 20px 64px; }
.shop-header { margin-bottom: 28px; }
.shop-header h1 { font-size: 2rem; margin: 10px 0 4px; letter-spacing: -0.02em; }
.badge { display: inline-block; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--accent); background: var(--accent-soft); padding: 4px 10px; border-radius: 999px; }

.shop-grid { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 20px; align-items: start; }
@media (max-width: 760px) { .shop-grid { grid-template-columns: minmax(0, 1fr); } .summary { position: static; } }

.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); }
.products { display: grid; gap: 14px; }
.product { display: flex; align-items: center; gap: 16px; padding: 16px; }
.product-art { width: 64px; height: 64px; flex: none; display: grid; place-items: center; font-size: 30px; background: var(--accent-soft); border-radius: 12px; }
.product-info { flex: 1; min-width: 0; }
.product-info h2 { font-size: 1.05rem; }
.price { font-weight: 600; margin-top: 4px; }

.stepper { display: flex; align-items: center; border: 1px solid var(--border); border-radius: 999px; overflow: hidden; }
.stepper button { width: 36px; height: 36px; border: 0; background: transparent; color: var(--text); font-size: 1.1rem; cursor: pointer; }
.stepper button:hover { background: var(--accent-soft); }
.stepper span { min-width: 28px; text-align: center; font-variant-numeric: tabular-nums; font-weight: 600; }

.summary { padding: 20px; position: sticky; top: 20px; display: grid; gap: 14px; }
.summary h2 { font-size: 1.1rem; }
.lines { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.lines li { display: flex; justify-content: space-between; gap: 12px; color: var(--muted); }
.total-row { display: flex; justify-content: space-between; align-items: baseline; padding-top: 12px; border-top: 1px solid var(--border); font-size: 1.1rem; }
.fine-print { font-size: 0.8rem; color: var(--muted); }

.north-checkout { display: grid; gap: 10px; }
.north-pay-button { width: 100%; padding: 13px 16px; border: 0; border-radius: 10px; background: var(--accent); color: var(--accent-text); font: inherit; font-weight: 600; cursor: pointer; transition: opacity 0.15s; }
.north-pay-button:hover:not(:disabled) { opacity: 0.9; }
.north-pay-button:disabled { opacity: 0.5; cursor: not-allowed; }
.north-total { color: var(--muted); }
.north-error { color: var(--danger); font-size: 0.9rem; }
.north-form:empty { display: none; }
.north-form { border-radius: 10px; overflow: hidden; }

.result { max-width: 480px; margin: 12vh auto; padding: 32px; text-align: center; display: grid; gap: 12px; justify-items: center; }
.result-icon { width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; font-size: 28px; background: var(--accent-soft); color: var(--accent); }
.result-icon.bad { background: color-mix(in srgb, var(--danger) 15%, transparent); color: var(--danger); }
.result a { color: var(--accent); font-weight: 600; text-decoration: none; }
