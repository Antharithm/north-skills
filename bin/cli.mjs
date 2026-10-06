#!/usr/bin/env node
/**
 * create-north-app - one command to start building with North.
 *
 *   npx create-north-app                       interactive (once published to npm)
 *   npx github:Antharithm/north-skills         interactive, straight from GitHub
 *   node bin/cli.mjs --help                    flags for CI / non-interactive use
 *
 * Asks: which North product, which AI agent(s), which framework, new or existing project.
 * Then: copies the agent skills into the agent's skills folder and writes the starter
 * integration via the skill's own scaffold script (the same one the agent runs after
 * `npx skills add`), so both install paths produce identical code.
 * Never overwrites an existing file. Never asks for or writes a secret.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { banner, box, color as c, confirm, multiselect, select, text } from "./prompts.mjs";
import { detectFramework, scaffold } from "../skills/north-embedded-checkout/scripts/scaffold.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;

// ---- What the installer offers ----------------------------------------------

/** North products. Only Embedded Checkout ships today; the rest are listed so people know they are coming. */
const PRODUCTS = [
  { value: "embedded-checkout", label: "Embedded Checkout", hint: "hosted payment form, PCI-light" },
  { value: "payment-api", label: "Payment API", hint: "(coming soon)", disabled: true },
  { value: "merchant-boarding", label: "Merchant Boarding API", hint: "(coming soon)", disabled: true },
  { value: "recurring-billing", label: "Recurring Billing API", hint: "(coming soon)", disabled: true },
  { value: "reporting", label: "Business & Merchant Reporting APIs", hint: "(coming soon)", disabled: true },
  { value: "card-present", label: "Semi-integrated card-present", hint: "(coming soon)", disabled: true },
];

/** Agent -> project skills folder. Paths match the skills.sh CLI so both installers agree. */
const AGENTS = [
  { value: "claude-code", label: "Claude Code", dir: ".claude/skills" },
  { value: "cursor", label: "Cursor", dir: ".agents/skills" },
  { value: "codex", label: "Codex", dir: ".agents/skills" },
  { value: "gemini-cli", label: "Gemini CLI", dir: ".agents/skills" },
  { value: "github-copilot", label: "GitHub Copilot", dir: ".agents/skills" },
  { value: "windsurf", label: "Windsurf", dir: ".windsurf/skills" },
  { value: "antigravity", label: "Antigravity", dir: ".agents/skills" },
];

const FRAMEWORKS = [
  { value: "nextjs", label: "Next.js", hint: "App Router, TypeScript" },
  { value: "express", label: "Express", hint: "Node + TypeScript, plain HTML front end" },
  { value: "expo", label: "React Native / Expo", hint: "(coming soon)", disabled: true },
  { value: "swift", label: "iOS (Swift)", hint: "(coming soon)", disabled: true },
];

/** Skills offered, in install order. Descriptions come from each SKILL.md, shortened. */
const SKILLS = [
  { value: "learn-north", label: "learn-north", hint: "(Learn about North and payments. Invoked without…)" },
  { value: "north-embedded-checkout", label: "north-embedded-checkout", hint: "(Build or change North Embedded Checkout. Sets up…)" },
  { value: "north-doctor", label: "north-doctor", hint: "(Diagnose and fix a North integration. Finds…)" },
];

// ---- Flags (non-interactive) -------------------------------------------------

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const [k, inline] = a.slice(2).split("=");
    flags[k] = inline ?? (argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true);
  }
  return flags;
}

const HELP = `
${c.bold("create-north-app")} ${VERSION} - start building with North in one command

Usage
  npx create-north-app [flags]
  npx github:Antharithm/north-skills [flags]

Flags (any you omit are asked interactively)
  --product    embedded-checkout
  --skills     learn-north,north-embedded-checkout,north-doctor (default: all)
  --agents     claude-code,cursor,codex,gemini-cli,github-copilot,windsurf,antigravity
  --framework  nextjs | express
  --mode       new | existing
  --name       folder for a new project (default: north-checkout-app)
  --dir        path to an existing project (default: current folder)
  --yes        skip the final confirmation
`;

function pickValid(value, list, label) {
  if (value === undefined) return undefined;
  const hit = list.find((o) => o.value === value);
  if (!hit) fail(`Unknown ${label} "${value}". Options: ${list.filter((o) => !o.disabled).map((o) => o.value).join(", ")}`);
  if (hit.disabled) fail(`${hit.label} is coming soon. Today the installer supports: ${list.filter((o) => !o.disabled).map((o) => o.label).join(", ")}.`);
  return value;
}

function fail(message) {
  console.error(c.red(`✖ ${message}`));
  process.exit(1);
}

// ---- Skills -------------------------------------------------------------------

/** Skills always overwrite: they are ours, and a re-run should refresh them to this version. */
function installSkills(skills, agents, destDir, report) {
  const dirs = [...new Set(agents.map((a) => AGENTS.find((x) => x.value === a).dir))];
  for (const dir of dirs) {
    for (const skill of skills) {
      const to = path.join(destDir, dir, skill);
      fs.rmSync(to, { recursive: true, force: true });
      fs.cpSync(path.join(ROOT, "skills", skill), to, { recursive: true });
      report.skills.push(path.relative(process.cwd(), to) || to);
    }
  }
}

// ---- Main ---------------------------------------------------------------------

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  if (flags.help || flags.h) return console.log(HELP);
  if (flags.version) return console.log(VERSION);

  const interactive = process.stdin.isTTY && process.stdout.isTTY;
  const need = (name) => {
    if (!interactive) fail(`--${name} is required when not running in a terminal. See --help.`);
  };

  console.log(`\n${banner()}\n`);
  console.log(`${c.dim("◇")}  ${c.bold("North skills")} ${c.dim(`v${VERSION} · unofficial`)}`);
  console.log(`${c.dim("◇")}  Found ${c.green(String(SKILLS.length))} skills\n`);

  // 1. Product
  let product = pickValid(flags.product, PRODUCTS, "product");
  if (!product) {
    need("product");
    product = await select({ message: "What do you want to build with?", options: PRODUCTS });
  }

  // 2. Skills (all selected by default)
  let skills = typeof flags.skills === "string" ? flags.skills.split(",").map((x) => pickValid(x.trim(), SKILLS, "skill")) : undefined;
  if (!skills) {
    skills = interactive
      ? await multiselect({ message: "Select skills to install", options: SKILLS, initial: SKILLS.map((x) => x.value) })
      : SKILLS.map((x) => x.value);
  }

  // 3. Agents
  let agents = typeof flags.agents === "string" ? flags.agents.split(",").map((a) => pickValid(a.trim(), AGENTS, "agent")) : undefined;
  if (!agents) {
    need("agents");
    agents = await multiselect({ message: "Which AI coding agent(s) do you use?", options: AGENTS, initial: ["claude-code"] });
  }

  // 4. New or existing
  let mode = flags.mode;
  if (mode && !["new", "existing"].includes(mode)) fail('--mode must be "new" or "existing"');
  if (!mode) {
    need("mode");
    mode = await select({
      message: "Start a new project or add North to an existing one?",
      options: [
        { value: "new", label: "New project", hint: "blank starter app with checkout wired in" },
        { value: "existing", label: "Existing project", hint: "add North's files next to your code" },
      ],
    });
  }

  // 5. Where
  let destDir;
  if (mode === "new") {
    let name = typeof flags.name === "string" ? flags.name : undefined;
    if (!name) {
      if (!interactive) name = "north-checkout-app";
      else
        name = await text({
          message: "Project folder name:",
          initial: "north-checkout-app",
          validate: (v) => (/^[a-z0-9._-]+$/i.test(v) ? (fs.existsSync(path.resolve(v)) ? `"${v}" already exists` : undefined) : "Letters, numbers, . _ - only"),
        });
    }
    destDir = path.resolve(name);
    if (fs.existsSync(destDir)) fail(`"${name}" already exists. Pick another name or use --mode existing.`);
  } else {
    let dir = typeof flags.dir === "string" ? flags.dir : undefined;
    if (!dir && interactive)
      dir = await text({
        message: "Path to your project:",
        initial: ".",
        validate: (v) => (fs.existsSync(path.join(path.resolve(v), "package.json")) ? undefined : `No package.json in ${path.resolve(v)}`),
      });
    destDir = path.resolve(dir ?? ".");
    if (!fs.existsSync(path.join(destDir, "package.json"))) fail(`No package.json in ${destDir}. Run this from your project root or pass --dir.`);
  }

  // 6. Framework (detected for existing projects, confirmed by the user)
  let framework = pickValid(flags.framework, FRAMEWORKS, "framework");
  const detected = mode === "existing" ? detectFramework(destDir) : undefined;
  if (!framework) {
    need("framework");
    const options = FRAMEWORKS.map((f) => (f.value === detected && !f.disabled ? { ...f, hint: "detected in your project" } : f));
    framework = await select({ message: "Which framework?", options: detected && !FRAMEWORKS.find((f) => f.value === detected)?.disabled ? [options.find((o) => o.value === detected), ...options.filter((o) => o.value !== detected)] : options });
  }
  if (mode === "existing" && detected && detected !== framework) {
    console.log(c.yellow(`! This looks like a ${detected} project, but you picked ${framework}. Continuing as ${framework}.`));
  }

  // 7. Summary + confirm
  const rel = (p) => "./" + (path.relative(process.cwd(), p) || ".");
  const byDir = new Map();
  for (const a of agents) {
    const { dir, label } = AGENTS.find((x) => x.value === a);
    byDir.set(dir, [...(byDir.get(dir) ?? []), label]);
  }
  const summary = [];
  for (const [dir, labels] of byDir) {
    for (const skill of skills) {
      summary.push(c.cyan(rel(path.join(destDir, dir, skill))));
      summary.push(`  ${c.dim("copy →")} ${labels.join(", ")}`);
      summary.push("");
    }
  }
  summary.push(`${c.bold("Starter")}  ${PRODUCTS.find((p) => p.value === product).label} · ${FRAMEWORKS.find((f) => f.value === framework).label} · ${mode === "new" ? "new project" : "existing project"}`);
  summary.push(`  ${c.dim("→")} ${rel(destDir)}`);
  console.log("\n" + box("Installation Summary", summary) + "\n");
  if (!flags.yes && interactive && !(await confirm({ message: "Proceed with installation?" }))) {
    console.log(c.dim("Nothing written."));
    return;
  }

  // 8. Write
  let report;
  try {
    report = scaffold({ framework, mode, destDir });
  } catch (err) {
    fail(err.message);
  }
  report.skills = [];
  installSkills(skills, agents, destDir, report);

  // 9. Report
  console.log(`\n${c.green("✔")} ${c.bold("Done.")}`);
  if (report.written.length) console.log(`\n${c.bold("Wrote")}\n` + report.written.map((f) => `  ${c.green("+")} ${f}`).join("\n"));
  if (report.skipped.length) console.log(`\n${c.bold("Kept your existing files")} ${c.dim("(not overwritten)")}\n` + report.skipped.map((f) => `  ${c.yellow("=")} ${f}`).join("\n"));
  console.log(`\n${c.bold(`Installed ${skills.length} skill${skills.length === 1 ? "" : "s"}`)}\n` + report.skills.map((f) => `  ${c.green("✓")} ${f}`).join("\n"));

  const steps = [
    ...report.nextSteps,
    `Ask your agent: ${skills.map((x) => c.cyan("/" + x)).join(c.dim(" · "))}`,
  ];
  console.log(`\n${c.bold("Next")}\n` + steps.map((s, i) => `  ${i + 1}. ${s}`).join("\n") + "\n");
}

main().catch((err) => fail(err?.stack || String(err)));
