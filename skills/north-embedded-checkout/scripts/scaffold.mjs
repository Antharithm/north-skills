#!/usr/bin/env node
/**
 * scaffold.mjs - write North Embedded Checkout starter code into a project.
 *
 * Ships inside the skill, so it works after `npx skills add` with nothing else installed.
 * Used two ways:
 *   - by the agent, when /north-embedded-checkout runs in a project with no North code yet
 *   - by create-north-app (bin/cli.mjs), which imports scaffold() below
 *
 *   node scaffold.mjs --framework nextjs|express --mode new --name my-shop
 *   node scaffold.mjs --framework nextjs|express --mode existing [--dir .]
 *   node scaffold.mjs --detect [--dir .]        print the detected framework and exit
 *
 * Never overwrites an existing file. Never reads, asks for, or writes secret values.
 * Templates are stored as *.tpl so the user's TypeScript build never compiles them.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TEMPLATES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "templates");

export const SUPPORTED_FRAMEWORKS = ["nextjs", "express"];

/** Template names that npm or git would mangle are stored with a leading "_". */
const RENAME = { _gitignore: ".gitignore" };

export function detectFramework(dir) {
  let pkg = null;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  } catch {
    return undefined;
  }
  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
  if (deps.next) return "nextjs";
  if (deps.express) return "express";
  if (deps.expo || deps["react-native"]) return "expo";
  return undefined;
}

/**
 * Where North's files go. Next.js projects use app/ or src/app/; lib/ and components/
 * sit next to whichever the project already has. Relative imports in the templates
 * keep working because lib/ and components/ stay siblings of app/.
 */
function layoutFor(framework, dir, mode) {
  if (mode !== "existing" || framework !== "nextjs") return {};
  const base = fs.existsSync(path.join(dir, "src", "app")) ? "src/" : "";
  return { "app/": `${base}app/`, "lib/": `${base}lib/`, "components/": `${base}components/` };
}

function walk(dir, prefix = "") {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix + entry.name;
    if (entry.isDirectory()) files.push(...walk(path.join(dir, entry.name), rel + "/"));
    else files.push(rel);
  }
  return files;
}

function targetPath(rel, layout) {
  rel = rel.replace(/\.tpl$/, "");
  const base = path.basename(rel);
  if (RENAME[base]) rel = path.join(path.dirname(rel), RENAME[base]);
  for (const [from, to] of Object.entries(layout)) if (rel.startsWith(from)) return to + rel.slice(from.length);
  return rel;
}

function copyTree(srcDir, destDir, layout, report, vars) {
  for (const rel of walk(srcDir)) {
    const to = path.join(destDir, targetPath(rel, layout));
    const shown = path.relative(process.cwd(), to) || to;
    if (fs.existsSync(to)) {
      report.skipped.push(shown);
      continue;
    }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    let body = fs.readFileSync(path.join(srcDir, rel), "utf8");
    for (const [k, v] of Object.entries(vars)) body = body.replaceAll(`{{${k}}}`, v);
    fs.writeFileSync(to, body);
    report.written.push(shown);
  }
}

/** Add the NORTH_* section to .env.example and create an empty env file. Never touches existing values. */
function mergeEnv(templateFile, destDir, envName, report) {
  const template = fs.readFileSync(templateFile, "utf8");
  const exampleTo = path.join(destDir, ".env.example");
  const existing = fs.existsSync(exampleTo) ? fs.readFileSync(exampleTo, "utf8") : "";
  if (!existing.includes("NORTH_CHECKOUT_PRIVATE_KEY")) {
    const sep = existing ? (existing.endsWith("\n") ? "\n" : "\n\n") : "";
    fs.writeFileSync(exampleTo, existing + sep + template);
    report.written.push(path.relative(process.cwd(), exampleTo) + (existing ? " (North section appended)" : ""));
  }
  const envTo = path.join(destDir, envName);
  if (!fs.existsSync(envTo)) {
    fs.writeFileSync(envTo, template);
    report.written.push(path.relative(process.cwd(), envTo) + " (fill in your Sandbox credentials)");
  } else if (!fs.readFileSync(envTo, "utf8").includes("NORTH_CHECKOUT_PRIVATE_KEY")) {
    report.todo.push(`Copy the NORTH_* lines from .env.example into ${envName}.`);
  }
}

/**
 * Write the starter. Returns { written, skipped, todo, envFile, nextSteps }.
 * mode "new" creates destDir (must not exist); mode "existing" needs a package.json there.
 */
export function scaffold({ framework, mode, destDir }) {
  if (!SUPPORTED_FRAMEWORKS.includes(framework)) {
    throw new Error(`Framework "${framework}" is not supported yet. Supported: ${SUPPORTED_FRAMEWORKS.join(", ")}.`);
  }
  if (mode === "new" && fs.existsSync(destDir)) throw new Error(`${destDir} already exists.`);
  if (mode === "existing" && !fs.existsSync(path.join(destDir, "package.json"))) {
    throw new Error(`No package.json in ${destDir}. Run from the project root or pass --dir.`);
  }

  const tpl = path.join(TEMPLATES, framework);
  const vars = { PROJECT_NAME: path.basename(destDir) };
  const report = { written: [], skipped: [], todo: [] };
  const envFile = framework === "nextjs" ? ".env.local" : ".env";

  if (mode === "new") {
    fs.mkdirSync(destDir, { recursive: true });
    copyTree(path.join(tpl, "base"), destDir, {}, report, vars);
  }
  copyTree(path.join(tpl, "north"), destDir, layoutFor(framework, destDir, mode), report, vars);
  mergeEnv(path.join(tpl, "env.example.tpl"), destDir, envFile, report);

  const install =
    mode === "new"
      ? "npm install"
      : framework === "nextjs"
        ? "npm install server-only"
        : "npm install express && npm install -D tsx @types/express";
  const cd = mode === "new" ? `cd ${path.relative(process.cwd(), destDir) || "."} && ` : "";
  report.envFile = envFile;
  report.nextSteps = [
    cd + install,
    `Put your Sandbox credentials in ${envFile}. No North account yet? Sign up free at https://developer.north.com/register, then create a checkout at https://developer.north.com/dashboard/embedded-checkouts/designer`,
    ...report.todo,
    mode === "new"
      ? "npm run dev"
      : framework === "nextjs"
        ? "Render <NorthCheckout items={...} /> where your checkout button is, and replace lib/north/catalog.ts with your prices"
        : "Add app.use(northRouter) before any express.json(), call northCheckout.start() from your checkout button, and replace src/north/catalog.ts with your prices",
  ];
  return report;
}

// ---- Run directly ---------------------------------------------------------------

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const [k, inline] = argv[i].slice(2).split("=");
    flags[k] = inline ?? (argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true);
  }
  return flags;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const flags = parseFlags(process.argv.slice(2));
  const dir = path.resolve(typeof flags.dir === "string" ? flags.dir : ".");
  if (flags.detect) {
    console.log(detectFramework(dir) ?? "unknown");
    process.exit(0);
  }
  try {
    const mode = flags.mode === "new" ? "new" : flags.mode === "existing" ? "existing" : undefined;
    if (!mode) throw new Error('--mode must be "new" or "existing"');
    const framework = typeof flags.framework === "string" ? flags.framework : detectFramework(dir);
    const destDir = mode === "new" ? path.resolve(typeof flags.name === "string" ? flags.name : "north-checkout-app") : dir;
    const report = scaffold({ framework, mode, destDir });
    console.log("Wrote:\n" + report.written.map((f) => `  + ${f}`).join("\n"));
    if (report.skipped.length) console.log("Kept existing (not overwritten):\n" + report.skipped.map((f) => `  = ${f}`).join("\n"));
    console.log("Next:\n" + report.nextSteps.map((s, i) => `  ${i + 1}. ${s}`).join("\n"));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
