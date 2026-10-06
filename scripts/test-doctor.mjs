#!/usr/bin/env node
/**
 * test-doctor.mjs - every north-doctor check must (a) stay quiet on the clean starters
 * and (b) catch its own planted bug. Each case scaffolds a fresh starter, breaks one
 * thing, and asserts the expected check ID appears.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { scaffold } from "../skills/north-embedded-checkout/scripts/scaffold.mjs";
import { analyze, CHECKS } from "../skills/north-doctor/scripts/doctor.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, ".test-output", "doctor");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let n = 0;
function fresh(framework) {
  const dir = path.join(OUT, `${framework}-${++n}`);
  scaffold({ framework, mode: "new", destDir: dir });
  execFileSync("git", ["init", "-q"], { cwd: dir }); // so .gitignore is honoured via git check-ignore
  return dir;
}

function edit(dir, file, find, replace) {
  const p = path.join(dir, file);
  const before = fs.readFileSync(p, "utf8");
  const after = typeof find === "string" ? before.replace(find, replace) : before.replace(find, replace);
  if (after === before) throw new Error(`mutation did not apply: ${file}: ${find}`);
  fs.writeFileSync(p, after);
}

function write(dir, file, body) {
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  fs.writeFileSync(path.join(dir, file), body);
}

const N = "components/north/NorthCheckout.tsx";
const CASES = [
  // Secrets
  ["ND001", "nextjs", (d) => fs.appendFileSync(path.join(d, ".env.local"), "NEXT_PUBLIC_NORTH_CHECKOUT_PRIVATE_KEY=abc\n")],
  ["ND002", "nextjs", (d) => edit(d, N, "import { useState } from 'react';", "import { useState } from 'react';\nimport { createSession } from '../../lib/north/client';")],
  ["ND003", "nextjs", (d) => write(d, ".gitignore", "node_modules\n.next\n")],
  ["ND004", "nextjs", (d) => edit(d, "lib/north/client.ts", "import 'server-only';\n", "")],
  // Requests
  ["ND010", "nextjs", (d) => edit(d, "lib/north/client.ts", "(Embedded Checkout; Next.js)", "(Next.js)")],
  ["ND010", "express", (d) => edit(d, "src/north/client.ts", "(Embedded Checkout; Node.js)", "(Node.js)")],
  ["ND011", "nextjs", (d) => edit(d, N, "    setState('loading');", "    setState('loading');\n    await fetch('https://checkout.north.com/api/sessions/status');")],
  ["ND012", "nextjs", (d) => edit(d, "lib/north/client.ts", "      ProfileId: profileId,\n", "")],
  ["ND013", "nextjs", (d) => edit(d, "lib/north/client.ts", /\n\s*signal: AbortSignal\.timeout\(REQUEST_TIMEOUT_MS\),/g, "")],
  // Money
  ["ND020", "nextjs", (d) => {
    edit(d, "app/api/north/session/route.ts", "    items = parseCart(await request.json());", "    const body = await request.json();\n    items = parseCart(body);\n    void body.amount;");
  }],
  ["ND021", "nextjs", (d) => edit(d, "lib/north/client.ts", "amount: input.amountCents / 100,", "amount: (input.amountCents / 100).toFixed(2),")],
  ["ND022", "express", (d) => edit(d, "src/north/router.ts", "!Number.isInteger(quantity) || ", "")],
  // Verification
  ["ND030", "nextjs", (d) => edit(d, "app/api/north/verify/route.ts", "const outcome = isPaidInFull(status, fields, order.amountCents);", "const outcome = status === 'Approved' ? { paid: true as const } : { paid: false as const, reason: 'declined' };")],
  ["ND031", "nextjs", (d) => edit(d, N, "      unsubscribe();", "      unsubscribe();\n      fetch('/api/orders/mark-paid', { method: 'POST' });")],
  ["ND032", "express", (d) => {
    edit(d, "public/north-checkout.js", "    await window.checkout.mount(session.token, containerId);\n", "");
    edit(d, "public/north-checkout.js", "    // 2. Register", "    await window.checkout.mount(session.token, containerId);\n    // 2. Register");
  }],
  ["ND033", "express", (d) => {
    fs.rmSync(path.join(d, "src/north"), { recursive: true });
    write(d, "src/server.ts", "import express from 'express';\nconst app = express();\napp.use(express.static('public'));\napp.listen(3000);\n");
  }],
  // Webhooks
  ["ND040", "nextjs", (d) => edit(d, "app/api/webhooks/north/transaction/route.ts", "const rawBody = Buffer.from(await request.arrayBuffer());", "const rawBody = Buffer.from(JSON.stringify(await request.json()));")],
  ["ND040", "express", (d) => edit(d, "src/server.ts", "app.use(northRouter);", "app.use(express.json());\napp.use(northRouter);")],
  ["ND041", "nextjs", (d) => edit(d, "lib/north/webhook.ts", "getNorthConfig().checkoutPrivateKey", "process.env.WEBHOOK_SECRET!")],
  ["ND042", "nextjs", (d) => edit(d, "lib/north/webhook.ts", "return timingSafeEqual(ba, bb);", "return a === b;")],
  ["ND043", "nextjs", (d) => edit(d, "lib/north/webhook.ts", "headers.get('x-yourapp-timestamp')", "String(Date.now())")],
  ["ND044", "nextjs", (d) => {
    const f = "app/api/webhooks/north/transaction/route.ts";
    const p = path.join(d, f);
    fs.writeFileSync(p, fs.readFileSync(p, "utf8").split("\n").filter((l) => !/seenWebhooks|dedupeKey|Claim the key/.test(l)).join("\n"));
  }],
  ["ND045", "nextjs", (d) => fs.rmSync(path.join(d, "app/api/webhooks"), { recursive: true })],
  // Sessions
  ["ND050", "nextjs", (d) => edit(d, N, "sessionStorage.setItem(TOKEN_KEY", "localStorage.setItem(TOKEN_KEY")],
  ["ND051", "nextjs", (d) => edit(d, "app/api/north/session/route.ts", "export const runtime = 'nodejs';", "export const runtime = 'edge';")],
  // Mobile (synthetic Expo project)
  ["ND060", "expo", (d) => write(d, "app/checkout.tsx", "import { WebView } from 'react-native-webview';\nexport default function C() {\n  return <WebView source={{ html: '<script src=\"https://checkout.north.com/checkout.js\"></script>' }} />;\n}\n")],
  ["ND061", "expo", (d) => write(d, "app/checkout.tsx", "import { WebView } from 'react-native-webview';\nexport default function C({ t }: { t: string }) {\n  return <WebView source={{ uri: `https://pay.example.com/north.html?token=${t}` }} />;\n}\n")],
];

function expoProject() {
  const dir = path.join(OUT, `expo-${++n}`);
  write(dir, "package.json", JSON.stringify({ dependencies: { expo: "54", "react-native": "0.85" } }));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  return dir;
}

let failed = 0;
const fail = (msg) => {
  failed++;
  console.log(`FAIL ${msg}`);
};

// Clean starters: no findings at all.
for (const fw of ["nextjs", "express"]) {
  const { findings } = analyze(fresh(fw));
  if (findings.length) fail(`clean ${fw} has findings: ${findings.map((f) => `${f.id} ${f.file}:${f.line}`).join(", ")}`);
  else console.log(`ok   clean ${fw}: 0 findings`);
}

// Planted bugs.
const covered = new Set();
for (const [id, fw, mutate] of CASES) {
  const dir = fw === "expo" ? expoProject() : fresh(fw);
  try {
    mutate(dir);
  } catch (err) {
    fail(`${id} (${fw}): ${err.message}`);
    continue;
  }
  const ids = analyze(dir).findings.map((f) => f.id);
  if (ids.includes(id)) {
    covered.add(id);
    console.log(`ok   ${id} caught (${fw})`);
  } else fail(`${id} (${fw}) not caught; got [${ids.join(", ")}]`);
}

const untested = Object.keys(CHECKS).filter((id) => !covered.has(id));
if (untested.length) fail(`checks without a passing planted-bug test: ${untested.join(", ")}`);

console.log(failed ? `\n${failed} failure(s)` : `\nAll ${Object.keys(CHECKS).length} checks caught their planted bug; clean starters are clean.`);
process.exit(failed ? 1 : 0);
