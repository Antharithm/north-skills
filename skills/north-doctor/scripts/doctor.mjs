#!/usr/bin/env node
/**
 * doctor.mjs - check a North Embedded Checkout integration for known failure modes.
 *
 *   node doctor.mjs [--dir .]            human-readable report
 *   node doctor.mjs --json               findings as JSON (for the agent)
 *   node doctor.mjs --list               every check, what it catches
 *   node doctor.mjs --live [--origin http://localhost:3000]
 *                                        also call North's Sandbox with the project's own
 *                                        credentials: create a $1.00 session, read its status,
 *                                        and report the checkout's Domain. Never prints secrets.
 *
 * Static checks are heuristics over source text: they point at a line worth reading,
 * they do not prove a bug. Zero dependencies. Exit code 1 when any error is found.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// ---- Checks catalogue -------------------------------------------------------------

/** id -> metadata. Severity: error (breaks money or security), warn (likely bug), info (worth knowing). */
export const CHECKS = {
  ND001: { sev: "error", title: "Private key in a public env variable", why: "NEXT_PUBLIC_ / EXPO_PUBLIC_ / VITE_ / REACT_APP_ values are inlined into the browser or app bundle. Anyone can read the key, create sessions, and forge webhook signatures.", fix: "Rename to NORTH_CHECKOUT_PRIVATE_KEY (no public prefix), read it only in server code, and rotate the key in Checkout Designer if it was ever deployed." },
  ND002: { sev: "error", title: "Client code touches the private key or server-only North code", why: "Anything imported by a 'use client' component, a public/ script or a mobile screen ships to the user's device.", fix: "Call your own API route from the client; keep North's client, config and webhook modules server-only." },
  ND003: { sev: "error", title: "Env file with North credentials is not gitignored", why: "Committing the env file publishes the private key with the repo.", fix: "Add the file (e.g. .env, .env.local, .env*.local) to .gitignore. If it was ever committed, rotate the key." },
  ND004: { sev: "warn", title: "Server-only North module without import 'server-only'", why: "Without the guard, a client component can import it by accident and the bundler will try to ship the key.", fix: "Add `import 'server-only';` as the first line (npm install server-only)." },
  ND010: { sev: "error", title: "North requests without an 'Embedded Checkout' User-Agent", why: "North's integration guide requires the User-Agent to contain \"Embedded Checkout\". Node's default fetch UA is \"node\".", fix: "Send e.g. `User-Agent: my-app/1.0 (Embedded Checkout; Node.js)` on every server → North call." },
  ND011: { sev: "error", title: "North API called from the browser", why: "Session create and status need the private key, and the status endpoint rejects requests with an Origin header, which browsers always send.", fix: "Move the call to a server route; the browser calls your route." },
  ND012: { sev: "info", title: "Status call without a ProfileId header", why: "The docs list only checkoutId, but North's official sample also sends ProfileId.", fix: "Send both checkoutId and ProfileId headers on GET /api/sessions/status." },
  ND013: { sev: "warn", title: "North request without a timeout", why: "A hung request ties up your route (and the customer) indefinitely.", fix: "Pass `signal: AbortSignal.timeout(10_000)`, creating a fresh signal per call (a fired signal can't be reused on retry)." },
  ND020: { sev: "warn", title: "Amount or price read from the request body", why: "Anything in the request body is chosen by the customer. A client-sent price is a customer-chosen price.", fix: "Accept only { sku, quantity } from the browser and price the cart from your server's catalog or database." },
  ND021: { sev: "warn", title: "Session amount built with toFixed()", why: "toFixed() returns a string, and rounding floats at the end hides cent drift.", fix: "Keep integer cents; send `amount: amountCents / 100` as a number." },
  ND022: { sev: "warn", title: "Quantity not checked as a whole number", why: "Quantities like 2.5, -1 or 1e9 pass a `q < 1` check and change the total.", fix: "Require Number.isInteger(quantity) and a sane range (e.g. 1-20) before pricing." },
  ND030: { sev: "error", title: "Paid decided by status === 'Approved' alone", why: "A partial approval comes back Approved with auth_resp ≠ \"00\" and a lower auth_amount. Shipping on status alone gives away the difference.", fix: "Paid = status Approved AND auth_resp === \"00\" AND auth_amount equals what you charged (see isPaidInFull in the starter)." },
  ND031: { sev: "error", title: "Order marked paid from the browser callback", why: "onPaymentComplete runs in the customer's browser: it can be faked from devtools, blocked, or never fire.", fix: "In the callback only navigate/show a spinner. Your server marks the order paid after GET /api/sessions/status (or a verified webhook)." },
  ND032: { sev: "warn", title: "onPaymentComplete registered after mount()", why: "If the payment completes before the listener is attached, the event is missed.", fix: "Call checkout.onPaymentComplete(...) before await checkout.mount(...)." },
  ND033: { sev: "error", title: "Nothing verifies the payment on the server", why: "The project mounts North's form but never calls GET /api/sessions/status or verifies a webhook, so 'paid' can only come from the browser.", fix: "Add a server verify route that calls the status endpoint (and optionally a signed webhook handler)." },
  ND040: { sev: "error", title: "Webhook body parsed before the signature is checked", why: "The HMAC is over the exact bytes North sent. Parsing then re-stringifying changes them and verification never matches (or, worse, gets switched off).", fix: "Read raw bytes (request.arrayBuffer() / express.raw()) and mount any global express.json() after the webhook route." },
  ND041: { sev: "warn", title: "Webhook HMAC keyed with a webhook/sec_ secret", why: "Transaction webhooks are signed with the checkout PRIVATE KEY. The sec_ secret belongs to the signup webhook scheme.", fix: "Key the HMAC with NORTH_CHECKOUT_PRIVATE_KEY." },
  ND042: { sev: "error", title: "Webhook signature compared with === instead of constant time", why: "String comparison leaks timing information about the expected signature.", fix: "Compare with crypto.timingSafeEqual on equal-length buffers." },
  ND043: { sev: "warn", title: "Webhook timestamp not checked", why: "Without a freshness window an old, captured request can be replayed.", fix: "Read X-YourApp-Timestamp (milliseconds) and reject anything more than ~5 minutes from now." },
  ND044: { sev: "warn", title: "Webhook handler without dedupe", why: "Webhooks are retried. Without an idempotency key the same payment can be fulfilled twice.", fix: "Hash the raw body, claim that key (unique index) BEFORE responding 200, and skip repeats." },
  ND045: { sev: "info", title: "No webhook handler", why: "The webhook is the second confirmation if the customer closes the tab before your verify call.", fix: "Add POST <base>/transaction with signature verification. North must allowlist the URL before it delivers." },
  ND050: { sev: "warn", title: "Session token kept in localStorage", why: "Tokens are single-attempt and expire after 30 minutes; a persisted token gets reused on the next visit and fails.", fix: "Keep the token in memory or sessionStorage and clear it after verification." },
  ND051: { sev: "error", title: "North code on the Edge runtime", why: "The North client and webhook verification use node:crypto and server secrets; the Edge runtime lacks node:crypto.", fix: "Use `export const runtime = 'nodejs'` on North route handlers." },
  ND060: { sev: "error", title: "WebView renders inline HTML for the checkout", why: "Inline HTML has a null origin, and the session token carries the Designer Domain, so mount() hangs with no error.", fix: "Load a real HTTPS page on the Checkout Designer Domain and inject the token through the WebView bridge." },
  ND061: { sev: "warn", title: "Session token passed in a URL", why: "URLs end up in logs, history and referrers.", fix: "Pass the token through the WebView bridge (postMessage/injectJavaScript) or a POST body." },
};

// ---- File discovery ------------------------------------------------------------------

const SKIP_DIRS = new Set(["node_modules", ".git", ".next", ".expo", ".vercel", ".turbo", "dist", "build", "out", "coverage", ".claude", ".agents", ".windsurf", "Pods", ".gradle", ".test-output"]);
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|html|vue|svelte)$/;
const ENV_FILE = /^\.env(\..+)?$/;

function walk(dir, root, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(full, root, out);
    } else if (CODE_EXT.test(e.name) || ENV_FILE.test(e.name)) {
      if (e.name.endsWith(".d.ts") || e.name.endsWith(".tpl")) continue;
      const stat = fs.statSync(full);
      if (stat.size > 1_000_000) continue;
      const raw = fs.readFileSync(full, "utf8");
      const text = ENV_FILE.test(e.name) ? raw.replace(/^\s*#.*$/gm, "") : e.name.endsWith(".html") ? raw.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " ")) : stripComments(raw);
      out.push({ rel: path.relative(root, full), text, raw });
    }
  }
  return out;
}

/**
 * Blank out comments (keeping newlines, so line numbers stay right) without touching
 * strings: "https://checkout.north.com" must survive, "// never request.json()" must not.
 */
export function stripComments(text) {
  let out = "";
  let i = 0;
  let state = "code"; // code | line | block | ' | " | `
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];
    if (state === "code") {
      if (ch === "/" && next === "/") { state = "line"; out += "  "; i += 2; continue; }
      if (ch === "/" && next === "*") { state = "block"; out += "  "; i += 2; continue; }
      if (ch === "'" || ch === '"' || ch === "`") state = ch;
      out += ch;
    } else if (state === "line") {
      if (ch === "\n") { state = "code"; out += ch; } else out += " ";
    } else if (state === "block") {
      if (ch === "*" && next === "/") { state = "code"; out += "  "; i += 2; continue; }
      out += ch === "\n" ? ch : " ";
    } else {
      out += ch;
      if (ch === "\\") { out += text[i + 1] ?? ""; i += 2; continue; }
      if (ch === state || (ch === "\n" && state !== "`")) state = "code";
    }
    i++;
  }
  return out;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function detectFramework(dir) {
  const pkg = readJson(path.join(dir, "package.json"));
  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
  if (deps.next) return "nextjs";
  if (deps.expo || deps["react-native"]) return "expo";
  if (deps.express) return "express";
  return pkg ? "node" : "unknown";
}

const SERVER_DIRS = /(^|\/)(functions|server|backend|api)\//;

/** Is this file shipped to the user's browser or device? */
function isClientFile(f, framework) {
  if (ENV_FILE.test(path.basename(f.rel))) return false;
  if (/^\s*(['"])use client\1/m.test(f.text.slice(0, 400))) return true;
  if (f.rel.endsWith(".html")) return true;
  if (/(^|\/)public\//.test(f.rel)) return true;
  if (framework === "expo") return !SERVER_DIRS.test(f.rel) && !f.rel.startsWith("scripts/");
  return false;
}

// ---- Helpers ------------------------------------------------------------------------

function lineOf(text, re) {
  const m = re.exec(text);
  if (!m) return null;
  return text.slice(0, m.index).split("\n").length;
}

const NORTH_API = /checkout\.north\.com[^\n]*\/api|\/api\/sessions/;
/** Makes HTTP requests to North's API (not just mentions the URL, e.g. in a trace or log string). */
const callsNorthApi = (t) => /checkout\.north\.com/.test(t) && /\/api\/sessions/.test(t) && /\bfetch\s*\(|axios|got\(|undici|https?\.request\(/.test(t);
/** Scripts, tests and fixtures: they sign fake webhooks or poke the API on purpose. */
const TOOLING = /(^|\/)(scripts|tests?|__tests__|fixtures|e2e|cypress|playwright)\/|\.(test|spec)\.[cm]?[jt]sx?$/;
const HANDLES_WEBHOOK = /x-yourapp-signature-256/i;

/** Code files git ignores (build output like functions/lib, generated bundles). Env files are kept: they're checked for leaks. */
function gitIgnoredSet(root, rels) {
  if (!rels.length) return new Set();
  try {
    const out = execFileSync("git", ["check-ignore", "--stdin"], { cwd: root, input: rels.join("\n"), stdio: ["pipe", "pipe", "ignore"] });
    return new Set(out.toString().split("\n").filter(Boolean));
  } catch (err) {
    // Exit 1 = nothing ignored; anything else = not a git repo or no git.
    return new Set(err.status === 1 ? [] : (err.stdout?.toString() ?? "").split("\n").filter(Boolean));
  }
}

function isGitignored(root, rel) {
  try {
    execFileSync("git", ["check-ignore", "-q", rel], { cwd: root, stdio: "ignore" });
    return true;
  } catch (err) {
    if (err.status === 1) return false; // git ran: not ignored
  }
  // Not a git repo (or no git): fall back to simple .gitignore globs.
  let lines = [];
  try {
    lines = fs.readFileSync(path.join(root, ".gitignore"), "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  } catch {
    return false;
  }
  const base = path.basename(rel);
  return lines.some((p) => {
    const re = new RegExp("^" + p.replace(/^\//, "").replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
    return re.test(base) || re.test(rel);
  });
}

// ---- Static analysis ------------------------------------------------------------------

export function analyze(root) {
  const framework = detectFramework(root);
  const all = walk(root, root);
  const ignored = gitIgnoredSet(root, all.filter((f) => !ENV_FILE.test(path.basename(f.rel))).map((f) => f.rel));
  const files = all.filter((f) => !ignored.has(f.rel));
  const findings = [];
  const add = (id, file, line, note) => findings.push({ id, ...CHECKS[id], file, line: line ?? 1, ...(note ? { note } : {}) });

  // Secrets checks (ND001) cover every file; behaviour checks skip tooling.
  const code = files.filter((f) => !ENV_FILE.test(path.basename(f.rel)) && !TOOLING.test(f.rel));
  const client = code.filter((f) => isClientFile(f, framework));
  const server = code.filter((f) => !isClientFile(f, framework));

  // ND001 public env prefix on a North secret (env files and code)
  const PUBLIC_SECRET = /\b(NEXT_PUBLIC|EXPO_PUBLIC|VITE|REACT_APP|PUBLIC)_[A-Z0-9_]*(NORTH|CHECKOUT)[A-Z0-9_]*(KEY|SECRET|PRIVATE)[A-Z0-9_]*/;
  for (const f of files) {
    const line = lineOf(f.text, PUBLIC_SECRET);
    if (line) add("ND001", f.rel, line);
  }

  // ND002 client code touching the key or server-only North modules
  const CLIENT_LEAK = /(NORTH_CHECKOUT_PRIVATE_KEY|CHECKOUT_PRIVATE_KEY|checkoutPrivateKey|from\s+['"][^'"]*north\/(client|config|webhook)['"])/;
  for (const f of client) {
    const line = lineOf(f.text, CLIENT_LEAK);
    if (line) add("ND002", f.rel, line);
  }

  // ND003 env files holding North credentials must be gitignored
  for (const f of files.filter((x) => ENV_FILE.test(path.basename(x.rel)) && !/example|sample|template/i.test(x.rel))) {
    if (/^\s*[A-Z0-9_]*CHECKOUT_PRIVATE_KEY\s*=/m.test(f.text) && !isGitignored(root, f.rel)) add("ND003", f.rel, 1);
  }

  // ND004 Next.js server modules that hold North secrets should import 'server-only'
  if (framework === "nextjs") {
    for (const f of server) {
      const holdsSecret = callsNorthApi(f.text) || /process\.env\.[A-Z0-9_]*CHECKOUT_PRIVATE_KEY/.test(f.text);
      if (holdsSecret && !/app\/|pages\/api\//.test(f.rel) && !/['"]server-only['"]/.test(f.text)) add("ND004", f.rel, 1);
    }
  }

  // ND010-ND013 server files that call North's API
  for (const f of server.filter((x) => callsNorthApi(x.text))) {
    const at = lineOf(f.text, NORTH_API);
    if (!/Embedded Checkout/.test(f.text)) add("ND010", f.rel, at);
    if (/\/api\/sessions\/status/.test(f.text) && !/\bProfileId\s*:|['"]ProfileId['"]/.test(f.text)) add("ND012", f.rel, lineOf(f.text, /\/api\/sessions\/status/));
    if (!/\bsignal\s*:|AbortSignal|AbortController|\btimeout\s*:/.test(f.text)) add("ND013", f.rel, at);
  }

  // ND011 browser calling North's API directly (a request near the URL, not just the URL as text)
  for (const f of client) {
    const lines = f.text.split("\n");
    const i = lines.findIndex((l, n) => /checkout\.north\.com\/api|\/api\/sessions/.test(l) && /checkout\.north\.com/.test(f.text) && /\bfetch\s*\(|axios|XMLHttpRequest|\.open\s*\(/.test(lines.slice(Math.max(0, n - 3), n + 1).join("\n")));
    if (i >= 0) add("ND011", f.rel, i + 1);
  }

  // ND020-ND022 session creation sites
  const createsSession = (t) => /\bcreateSession\s*\(/.test(t) && !/function\s+createSession/.test(t) || (callsNorthApi(t) && /method:\s*['"]POST['"]/.test(t) && /amount/.test(t) && /(req|request)\b/.test(t));
  for (const f of server.filter((x) => createsSession(x.text))) {
    const priceFromBody = lineOf(f.text, /\b(body|req\.body|request\.body|payload|json)\??\.(amount|price|total|unitPrice|amountCents)\b/);
    if (priceFromBody) add("ND020", f.rel, priceFromBody);
    if (/quantity/.test(f.text) && !/Number\.isInteger|Number\.isSafeInteger|\.int\(\)|isInt\(/.test(f.text)) add("ND022", f.rel, lineOf(f.text, /quantity/));
  }
  for (const f of server) {
    const line = lineOf(f.text, /amount\s*:\s*[^,\n]*\.toFixed\(/);
    if (line && callsNorthApi(f.text)) add("ND021", f.rel, line);
  }

  // ND030 paid decided by status alone: look at the lines around each comparison
  for (const f of code) {
    if (/\b(isPaidInFull|isNorthPaidInFull)\)?\s*\(/.test(f.text.replace(/^\s*import[^;]*;/gm, ""))) continue;
    const lines = f.text.split("\n");
    lines.forEach((l, i) => {
      if (!/[!=]==?\s*['"]Approved['"]|['"]Approved['"]\s*[!=]==?/.test(l)) return;
      const near = lines.slice(Math.max(0, i - 6), i + 7).join("\n");
      if (!/auth_?[Rr]esp|auth_?[Aa]mount/.test(near) && !findings.some((x) => x.id === "ND030" && x.file === f.rel)) add("ND030", f.rel, i + 1);
    });
  }

  // ND031 / ND032 browser callback
  for (const f of client.filter((x) => /onPaymentComplete/.test(x.text))) {
    const lines = f.text.split("\n");
    const start = lines.findIndex((l) => /onPaymentComplete\s*\(/.test(l));
    if (start >= 0) {
      const window = lines.slice(start, start + 20).join("\n");
      const hit = /(mark-?paid|markPaid|status\s*:\s*['"]paid['"]|paid\s*:\s*true|fulfil)/i.exec(window);
      if (hit) add("ND031", f.rel, start + 1 + window.slice(0, hit.index).split("\n").length - 1);
      const mountAt = lines.findIndex((l) => /\.mount\s*\(/.test(l));
      if (mountAt >= 0 && mountAt < start) add("ND032", f.rel, mountAt + 1);
    }
  }

  // Webhook files: anything verifying North's signature. Handlers: the ones answering the HTTP request.
  const webhookFiles = server.filter((f) => HANDLES_WEBHOOK.test(f.text) || /verifySignature\s*\(/.test(f.text));
  const handlers = webhookFiles.filter((f) => /(export\s+(async\s+)?function\s+POST|export\s+const\s+POST|\.post\s*\(|res\.status|new Response)/.test(f.text));

  // ND033 nothing on the server verifies
  const mounts = code.some((f) => /\.mount\s*\(/.test(f.text) && /checkout/.test(f.text));
  const verifies = server.some((f) => /\/api\/sessions\/status/.test(f.text) && callsNorthApi(f.text)) || handlers.length > 0;
  if (mounts && !verifies) {
    const f = code.find((x) => /\.mount\s*\(/.test(x.text));
    add("ND033", f.rel, lineOf(f.text, /\.mount\s*\(/));
  }

  // ND040-ND045 webhooks
  for (const f of webhookFiles) {
    const reparsed = lineOf(f.text, /JSON\.stringify\(\s*(await\s+)?(req\.body|request\.body|body|payload|await\s+request\.json\(\))/);
    const parsedFirst = /verifySignature\s*\(/.test(f.text) && lineOf(f.text, /request\.json\(\)/);
    if (reparsed || parsedFirst) add("ND040", f.rel, reparsed ?? parsedFirst);
    if (/createHmac/.test(f.text) && HANDLES_WEBHOOK.test(f.text)) {
      const wrongKey = lineOf(f.text, /WEBHOOK_SECRET|['"`]sec_/);
      if (wrongKey) add("ND041", f.rel, wrongKey);
      if (!/timingSafeEqual\s*\(/.test(f.text)) add("ND042", f.rel, lineOf(f.text, /createHmac/));
      if (!/x-yourapp-timestamp/i.test(f.text)) add("ND043", f.rel, lineOf(f.text, HANDLES_WEBHOOK));
    }
  }
  for (const f of handlers) {
    if (!/seen|dedupe|idempot|processed|unique|already/i.test(f.text)) add("ND044", f.rel, lineOf(f.text, /verifySignature\s*\(|x-yourapp-signature-256/i));
  }
  // Express: a global JSON parser mounted before the webhook route
  for (const f of server) {
    const lines = f.text.split("\n");
    const globalJson = lines.findIndex((l) => /app\.use\(\s*(express\.json|bodyParser\.json)\s*\(/.test(l));
    const webhookAt = lines.findIndex((l) => /app\.use\(\s*northRouter|app\.post\([^)]*webhook/i.test(l));
    if (globalJson >= 0 && webhookAt >= 0 && globalJson < webhookAt) add("ND040", f.rel, globalJson + 1, "global JSON parser runs before the webhook route");
  }
  if (mounts && handlers.length === 0) add("ND045", ".", 1);

  // ND050 token persisted
  for (const f of client) {
    const line = lineOf(f.text, /localStorage\.setItem\([^)]*(token|session)/i);
    if (line) add("ND050", f.rel, line);
  }

  // ND051 Edge runtime
  for (const f of server) {
    const line = lineOf(f.text, /export\s+const\s+runtime\s*=\s*['"]edge['"]/);
    if (line && (/north/i.test(f.text) || /node:crypto/.test(f.text))) add("ND051", f.rel, line);
  }

  // ND060 / ND061 mobile WebView
  for (const f of code.filter((x) => /WebView/.test(x.text))) {
    const inline = lineOf(f.text, /source=\{\{\s*html\s*:/);
    if (inline && /checkout\.north\.com|north/i.test(f.text)) add("ND060", f.rel, inline);
    const inUrl = lineOf(f.text, /uri\s*:\s*[^}\n]*[?&](session)?token=/i);
    if (inUrl) add("ND061", f.rel, inUrl);
  }

  const order = { error: 0, warn: 1, info: 2 };
  findings.sort((a, b) => order[a.sev] - order[b.sev] || a.id.localeCompare(b.id));
  return { framework, scanned: files.length, findings };
}

// ---- Live checks (opt-in) -----------------------------------------------------------

function readEnv(root) {
  const env = {};
  for (const name of [".env", ".env.local"]) {
    try {
      for (const line of fs.readFileSync(path.join(root, name), "utf8").split("\n")) {
        const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
        if (m && m[2]) env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
      }
    } catch {}
  }
  return env;
}

export async function live(root, origin) {
  const env = readEnv(root);
  const key = env.NORTH_CHECKOUT_PRIVATE_KEY ?? env.CHECKOUT_PRIVATE_KEY;
  const checkoutId = env.NORTH_CHECKOUT_ID ?? env.CHECKOUT_ID;
  const profileId = env.NORTH_PROFILE_ID ?? env.PROFILE_ID;
  const results = [];
  const ok = (name, detail) => results.push({ ok: true, name, detail });
  const bad = (name, detail, fix) => results.push({ ok: false, name, detail, fix });

  const missing = [["NORTH_CHECKOUT_PRIVATE_KEY", key], ["NORTH_CHECKOUT_ID", checkoutId], ["NORTH_PROFILE_ID", profileId]].filter(([, v]) => !v).map(([n]) => n);
  if (missing.length) {
    bad("Credentials", `missing in .env / .env.local: ${missing.join(", ")}`, "Copy them from your checkout at https://developer.north.com/dashboard/embedded-checkouts (no account yet? https://developer.north.com/register).");
    return results;
  }
  ok("Credentials", "all three present (values not shown)");

  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Accept-Language": "en", "User-Agent": "north-doctor/0.1 (Embedded Checkout; Node.js)" };
  let token;
  try {
    const res = await fetch("https://checkout.north.com/api/sessions", {
      method: "POST",
      headers,
      body: JSON.stringify({ checkoutId, profileId, amount: 1, products: [{ name: "north-doctor check", price: 1, quantity: 1 }] }),
      signal: AbortSignal.timeout(10_000),
    });
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {}
    if (!res.ok || typeof data?.token !== "string") {
      const msg = (data && (data.message || data.error || data.title)) || text.slice(0, 160);
      bad("Create session", `HTTP ${res.status}: ${msg}`, res.status === 401 || res.status === 403 ? "The private key is wrong, or belongs to a different checkout than NORTH_CHECKOUT_ID (keys are per checkout)." : "Check checkoutId/profileId and that amount equals the products total.");
      return results;
    }
    token = data.token;
    ok("Create session", `HTTP ${res.status}, token issued ($1.00, nothing charged)`);
  } catch (err) {
    bad("Create session", `request failed: ${err.message}`, "Check network access to checkout.north.com.");
    return results;
  }

  try {
    const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    if (claims.expiresAt) ok("Token lifetime", `expires ${claims.expiresAt}`);
    const domain = claims.domain;
    if (domain === undefined) ok("Checkout Domain", "not present in the token");
    else if (domain === "*" || domain === "") ok("Checkout Domain", `"${domain}" (form mounts on any origin)`);
    else {
      let host = null;
      try {
        host = new URL(origin).host;
      } catch {}
      const matches = host && (domain === host || domain === origin || domain.replace(/^https?:\/\//, "") === host);
      if (matches) ok("Checkout Domain", `"${domain}" matches ${origin}`);
      else bad("Checkout Domain", `"${domain}" but your page is ${origin}`, `mount() will hang on ${origin}. Serve the page from ${domain}, or change Domain in Checkout Designer (a tunnel URL works for local dev).`);
    }
  } catch {
    ok("Checkout Domain", "token claims not readable (skipped)");
  }

  try {
    const res = await fetch("https://checkout.north.com/api/sessions/status", {
      headers: { ...headers, SessionToken: token, checkoutId, ProfileId: profileId },
      signal: AbortSignal.timeout(10_000),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.status) ok("Session status", `HTTP ${res.status}, status "${data.status}"`);
    else bad("Session status", `HTTP ${res.status}`, "Status needs SessionToken, checkoutId (and ProfileId) headers and no Origin header.");
  } catch (err) {
    bad("Session status", `request failed: ${err.message}`, "Check network access to checkout.north.com.");
  }
  return results;
}

// ---- CLI ---------------------------------------------------------------------------------

const color = process.stdout.isTTY
  ? { red: (s) => `\x1b[31m${s}\x1b[39m`, yellow: (s) => `\x1b[33m${s}\x1b[39m`, cyan: (s) => `\x1b[36m${s}\x1b[39m`, green: (s) => `\x1b[32m${s}\x1b[39m`, dim: (s) => `\x1b[2m${s}\x1b[22m`, bold: (s) => `\x1b[1m${s}\x1b[22m` }
  : Object.fromEntries(["red", "yellow", "cyan", "green", "dim", "bold"].map((k) => [k, (s) => s]));
const ICON = { error: color.red("✖"), warn: color.yellow("▲"), info: color.cyan("●") };
const FRAMEWORK_NAME = { nextjs: "Next.js", express: "Express", expo: "React Native / Expo", node: "Node", unknown: "unknown" };

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const [k, inline] = argv[i].slice(2).split("=");
    flags[k] = inline ?? (argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true);
  }
  return flags;
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  if (flags.list) {
    for (const [id, c] of Object.entries(CHECKS)) console.log(`${ICON[c.sev]} ${id}  ${c.title}`);
    return;
  }
  const root = path.resolve(typeof flags.dir === "string" ? flags.dir : ".");
  const report = analyze(root);
  if (flags.live) report.live = await live(root, typeof flags.origin === "string" ? flags.origin : "http://localhost:3000");

  if (flags.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const n = (sev) => report.findings.filter((f) => f.sev === sev).length;
    console.log(`\n${color.bold("North Doctor")} ${color.dim(`· ${FRAMEWORK_NAME[report.framework]} · ${report.scanned} files scanned`)}\n`);
    for (const f of report.findings) {
      console.log(`${ICON[f.sev]} ${color.bold(f.id)}  ${f.title}  ${color.dim(`${f.file}:${f.line}`)}`);
      if (f.note) console.log(`   ${color.dim(f.note)}`);
      console.log(`   ${color.dim("Why:")} ${f.why}\n   ${color.dim("Fix:")} ${f.fix}\n`);
    }
    if (report.live) {
      console.log(color.bold("Live (Sandbox)"));
      for (const r of report.live) {
        console.log(`${r.ok ? color.green("✔") : color.red("✖")} ${r.name}: ${r.detail}`);
        if (r.fix) console.log(`   ${color.dim("Fix:")} ${r.fix}`);
      }
      console.log("");
    }
    if (!report.findings.length) console.log(color.green("✔ No known North integration problems found.\n"));
    console.log(`${n("error")} errors · ${n("warn")} warnings · ${n("info")} info`);
    console.log(color.dim("Static checks are heuristics: read the line before changing it.\n"));
  }
  const failed = report.findings.some((f) => f.sev === "error") || (report.live ?? []).some((r) => !r.ok);
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
