#!/usr/bin/env node
// @ts-check
/**
 * create-north-app - one command to start building with North.
 *
 *   npx create-north-app                       interactive (once published to npm)
 *   npx github:Antharithm/north-skills         interactive, straight from GitHub
 *   node bin/cli.mjs --help                    flags for CI / non-interactive use
 *
 * Asks: which North product, which AI agent(s), which framework, new or existing project.
 * Every question shows a navigation map and its keys; ← (or esc) goes back one question.
 * Then: copies the agent skills into the agent's skills folder and writes the starter
 * integration via the skill's own scaffold script (the same one the agent runs after
 * `npx skills add`), so both install paths produce identical code.
 * Never overwrites an existing file. Never asks for or writes a secret.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { BACK, banner, box, color as c, eraseTo, mark, multiselect, print, select, text } from "./prompts.mjs";
import { detectFramework, scaffold } from "../skills/north-embedded-checkout/scripts/scaffold.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;

// ---- What the installer offers ----------------------------------------------

/** @typedef {import("./prompts.mjs").Option} Option */

/** North products. Only Embedded Checkout ships today; the rest are listed so people know they are coming. @type {Option[]} */
const PRODUCTS = [
  { value: "embedded-checkout", label: "Embedded Checkout", hint: "hosted payment form, PCI-light" },
  { value: "payment-api", label: "Payment API", hint: "(coming soon)", disabled: true },
  { value: "merchant-boarding", label: "Merchant Boarding API", hint: "(coming soon)", disabled: true },
  { value: "recurring-billing", label: "Recurring Billing API", hint: "(coming soon)", disabled: true },
  { value: "reporting", label: "Business & Merchant Reporting APIs", hint: "(coming soon)", disabled: true },
  { value: "card-present", label: "Semi-integrated card-present", hint: "(coming soon)", disabled: true },
];

/** Agent -> project skills folder. Paths match the skills.sh CLI so both installers agree. @type {(Option & { dir: string })[]} */
const AGENTS = [
  { value: "claude-code", label: "Claude Code", dir: ".claude/skills" },
  { value: "cursor", label: "Cursor", dir: ".agents/skills" },
  { value: "codex", label: "Codex", dir: ".agents/skills" },
  { value: "gemini-cli", label: "Gemini CLI", dir: ".agents/skills" },
  { value: "github-copilot", label: "GitHub Copilot", dir: ".agents/skills" },
  { value: "windsurf", label: "Windsurf", dir: ".windsurf/skills" },
  { value: "antigravity", label: "Antigravity", dir: ".agents/skills" },
  { value: "opencode", label: "OpenCode", dir: ".agents/skills" },
];

/** @type {Option[]} */
const FRAMEWORKS = [
  { value: "nextjs", label: "Next.js", hint: "App Router, TypeScript" },
  { value: "express", label: "Express", hint: "Node + TypeScript, plain HTML front end" },
  { value: "expo", label: "React Native / Expo", hint: "(coming soon)", disabled: true },
  { value: "swift", label: "iOS (Swift)", hint: "(coming soon)", disabled: true },
];

/** Skills offered, in install order. Descriptions come from each SKILL.md, shortened. @type {Option[]} */
const SKILLS = [
  { value: "learn-north", label: "learn-north", hint: "(Learn about North and payments. Invoked without…)" },
  { value: "north-embedded-checkout", label: "north-embedded-checkout", hint: "(Build or change North Embedded Checkout. Sets up…)" },
  { value: "north-doctor", label: "north-doctor", hint: "(Diagnose and fix a North integration. Finds…)" },
];

const SIGNUP_URL = "https://developer.north.com/register";
const DESIGNER_URL = "https://developer.north.com/dashboard/embedded-checkouts/designer";
const CHECKOUTS_URL = "https://developer.north.com/dashboard/embedded-checkouts";

/** Open a URL in the default browser. Best effort: failures are ignored, the URL is printed anyway. */
/** @param {string} url */
function openUrl(url) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try {
    spawn(cmd, args, { stdio: "ignore", detached: true }).on("error", () => {}).unref();
  } catch {}
}

// ---- Flags (non-interactive) -------------------------------------------------

/** @param {string[]} argv @returns {Record<string, string | true>} */
function parseFlags(argv) {
  /** @type {Record<string, string | true>} */
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
  --account    yes | no   (do you already have a North developer account?)
  --agents     claude-code,cursor,codex,gemini-cli,github-copilot,windsurf,antigravity,opencode
  --framework  nextjs | express
  --mode       new | existing
  --name       folder for a new project (default: north-checkout-app)
  --dir        path to an existing project (default: current folder)
  --yes        skip the final confirmation
`;

/** Validate a flag value against a list. Exits on unknown or coming-soon values. @param {string | true} value @param {Option[]} list @param {string} label @returns {string} */
function pick(value, list, label) {
  const hit = list.find((o) => o.value === value);
  if (!hit) return fail(`Unknown ${label} "${value}". Options: ${list.filter((o) => !o.disabled).map((o) => o.value).join(", ")}`);
  if (hit.disabled) fail(`${hit.label} is coming soon. Today the installer supports: ${list.filter((o) => !o.disabled).map((o) => o.label).join(", ")}.`);
  return hit.value;
}

/** @param {string | true | undefined} value @param {Option[]} list @param {string} label @returns {string | undefined} */
function pickValid(value, list, label) {
  return value === undefined ? undefined : pick(value, list, label);
}

/** @param {Option[]} list @param {string} value */
const labelOf = (list, value) => list.find((o) => o.value === value)?.label ?? value;

/** The installer's questions, in order, as shown in the navigation map. */
const MAP = ["Product", "Account", "Skills", "Agents", "Project", "Folder", "Framework", "Install"];

/** Navigation map shown above every question: done steps green, the current one in [brackets]. @param {number} at */
const navMap = (at) => MAP.map((s, i) => (i < at ? c.green(s) : i === at ? c.cyan(c.bold(`[${s}]`)) : c.dim(s))).join(c.dim(" › "));

/** @param {string} id */
function agentById(id) {
  const agent = AGENTS.find((x) => x.value === id);
  if (!agent) return fail(`Unknown agent "${id}"`);
  return agent;
}

/** @param {string} message @returns {never} */
function fail(message) {
  console.error(c.red(`✖ ${message}`));
  process.exit(1);
}

// ---- Skills -------------------------------------------------------------------

/**
 * Skills always overwrite: they are ours, and a re-run should refresh them to this version.
 * @param {string[]} skills @param {string[]} agents @param {string} destDir @returns {string[]} installed paths
 */
function installSkills(skills, agents, destDir) {
  const dirs = [...new Set(agents.map((a) => agentById(a).dir))];
  /** @type {string[]} */
  const installed = [];
  for (const dir of dirs) {
    for (const skill of skills) {
      const to = path.join(destDir, dir, skill);
      fs.rmSync(to, { recursive: true, force: true });
      fs.cpSync(path.join(ROOT, "skills", skill), to, { recursive: true });
      installed.push(path.relative(process.cwd(), to) || to);
    }
  }
  return installed;
}

// ---- Main ---------------------------------------------------------------------

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  if (flags.help || flags.h) return console.log(HELP);
  if (flags.version) return console.log(VERSION);

  const interactive = process.stdin.isTTY && process.stdout.isTTY;
  /** @param {string} name */
  const need = (name) => {
    if (!interactive) fail(`--${name} is required when not running in a terminal. See --help.`);
  };

  console.log(`\n${banner()}\n`);
  console.log(`${c.dim("◇")}  ${c.bold("North skills")} ${c.dim(`v${VERSION} · unofficial`)}`);
  console.log(`${c.dim("◇")}  Found ${c.green(String(SKILLS.length))} skills ${c.dim("· ← back · ctrl+c quit")}\n`);

  /** @type {string | undefined} */
  let product;
  /** @type {boolean | undefined} */
  let hasAccount;
  /** @type {string[] | undefined} */
  let skills;
  /** @type {string[] | undefined} */
  let agents;
  /** @type {"new" | "existing" | undefined} */
  let mode;
  /** @type {string | undefined} */
  let destDir;
  /** @type {string | undefined} */
  let framework;
  let cancelled = false;

  /** @param {string} p */
  const rel = (p) => "./" + (path.relative(process.cwd(), p) || ".");

  // Each question is a step so ← (or esc) can return to the previous one. A step returns
  // "asked" if it showed a prompt, "skipped" if flags or defaults answered it, or BACK.
  // `map` is the step's place in MAP, the navigation line shown above every question.
  /** @type {{ map: number, run: (back: boolean, map: string) => Promise<"asked" | "skipped" | typeof BACK> }[]} */
  const questions = [
    // 1. Product
    {
      map: 0,
      run: async (back, map) => {
        const flag = pickValid(flags.product, PRODUCTS, "product");
        if (flag) {
          product = flag;
          return "skipped";
        }
        need("product");
        const answer = await select({ message: "What do you want to build with?", options: PRODUCTS, initial: product, back, map });
        if (answer === BACK) return BACK;
        product = answer;
        return "asked";
      },
    },
    // 1b. Account: never assume one exists
    {
      map: 1,
      run: async (back, map) => {
        if (flags.account === "yes" || flags.account === "no") {
          hasAccount = flags.account === "yes";
          return "skipped";
        }
        if (!interactive) return "skipped";
        const answer = await select({
          message: "Do you have a North developer account?",
          options: [
            { value: "yes", label: "Yes, I have my Sandbox keys" },
            { value: "no", label: "No, I need to sign up", hint: "free, no paperwork for Sandbox" },
          ],
          initial: hasAccount === undefined ? undefined : hasAccount ? "yes" : "no",
          back,
          map,
        });
        if (answer === BACK) return BACK;
        hasAccount = answer === "yes";
        return "asked";
      },
    },
    // 1c. No account yet: where to get Sandbox keys
    {
      map: 1,
      run: async (back, map) => {
        if (hasAccount !== false) return "skipped";
        print(
          "\n" +
            box("Get your North Sandbox keys", [
              `1. Sign up (free)      ${c.cyan(SIGNUP_URL)}`,
              `2. Create a checkout   ${c.cyan(DESIGNER_URL)}`,
              `   Set Domain to the address your page runs on, then Save Checkout.`,
              `3. Copy its keys       ${c.cyan(CHECKOUTS_URL)}`,
              `   private key, checkout ID, profile ID → your env file`,
              "",
              c.dim("Carry on here: the code works as soon as the keys are in."),
            ]) +
            "\n",
        );
        if (!interactive) return "skipped";
        const answer = await select({
          message: "Open the sign-up page in your browser?",
          options: [
            { value: "yes", label: "Yes, open it" },
            { value: "no", label: "No, I'll do it later" },
          ],
          back,
          map,
        });
        if (answer === BACK) return BACK;
        if (answer === "yes") openUrl(SIGNUP_URL);
        return "asked";
      },
    },
    // 2. Skills (all selected by default)
    {
      map: 2,
      run: async (back, map) => {
        if (typeof flags.skills === "string") {
          skills = flags.skills.split(",").map((x) => pick(x.trim(), SKILLS, "skill"));
          return "skipped";
        }
        if (!interactive) {
          skills = SKILLS.map((x) => x.value);
          return "skipped";
        }
        const answer = await multiselect({ message: "Select skills to install", options: SKILLS, initial: skills ?? SKILLS.map((x) => x.value), back, map });
        if (answer === BACK) return BACK;
        skills = answer;
        return "asked";
      },
    },
    // 3. Agents
    {
      map: 3,
      run: async (back, map) => {
        if (typeof flags.agents === "string") {
          agents = flags.agents.split(",").map((a) => pick(a.trim(), AGENTS, "agent"));
          return "skipped";
        }
        need("agents");
        const answer = await multiselect({ message: "Which AI coding agent(s) do you use?", options: AGENTS, initial: agents ?? ["claude-code"], back, map });
        if (answer === BACK) return BACK;
        agents = answer;
        return "asked";
      },
    },
    // 4. New or existing
    {
      map: 4,
      run: async (back, map) => {
        if (flags.mode !== undefined) {
          if (flags.mode !== "new" && flags.mode !== "existing") fail('--mode must be "new" or "existing"');
          mode = flags.mode;
          return "skipped";
        }
        need("mode");
        const answer = await select({
          message: "Start a new project or add North to an existing one?",
          options: [
            { value: "new", label: "New project", hint: "blank starter app with checkout wired in" },
            { value: "existing", label: "Existing project", hint: "add North's files next to your code" },
          ],
          initial: mode,
          back,
          map,
        });
        if (answer === BACK) return BACK;
        mode = /** @type {"new" | "existing"} */ (answer);
        return "asked";
      },
    },
    // 5. Where
    {
      map: 5,
      run: async (back, map) => {
        /** @type {"asked" | "skipped"} */
        let result = "skipped";
        if (mode === "new") {
          let name = typeof flags.name === "string" ? flags.name : undefined;
          if (!name && !interactive) name = "north-checkout-app";
          if (!name) {
            const answer = await text({
              message: "Project folder name:",
              initial: destDir ? path.basename(destDir) : "north-checkout-app",
              validate: (v) => (/^[a-z0-9._-]+$/i.test(v) ? (fs.existsSync(path.resolve(v)) ? `"${v}" already exists` : undefined) : "Letters, numbers, . _ - only"),
              back,
              map,
            });
            if (answer === BACK) return BACK;
            name = answer;
            result = "asked";
          }
          destDir = path.resolve(name);
          if (fs.existsSync(destDir)) fail(`"${name}" already exists. Pick another name or use --mode existing.`);
        } else {
          let dir = typeof flags.dir === "string" ? flags.dir : undefined;
          if (!dir && interactive) {
            const answer = await text({
              message: "Path to your project:",
              initial: destDir ? path.relative(process.cwd(), destDir) || "." : ".",
              validate: (v) => (fs.existsSync(path.join(path.resolve(v), "package.json")) ? undefined : `No package.json in ${path.resolve(v)}`),
              back,
              map,
            });
            if (answer === BACK) return BACK;
            dir = answer;
            result = "asked";
          }
          destDir = path.resolve(dir ?? ".");
          if (!fs.existsSync(path.join(destDir, "package.json"))) fail(`No package.json in ${destDir}. Run this from your project root or pass --dir.`);
        }
        return result;
      },
    },
    // 6. Framework (detected for existing projects, confirmed by the user)
    {
      map: 6,
      run: async (back, map) => {
        const detected = mode === "existing" && destDir ? detectFramework(destDir) : undefined;
        /** @type {"asked" | "skipped"} */
        let result = "skipped";
        const flag = pickValid(flags.framework, FRAMEWORKS, "framework");
        if (flag) framework = flag;
        else {
          need("framework");
          const options = FRAMEWORKS.map((f) => (f.value === detected && !f.disabled ? { ...f, hint: "detected in your project" } : f));
          const first = options.find((o) => o.value === detected && !o.disabled);
          const answer = await select({
            message: "Which framework?",
            options: first ? [first, ...options.filter((o) => o !== first)] : options,
            initial: framework ?? first?.value,
            back,
            map,
          });
          if (answer === BACK) return BACK;
          framework = answer;
          result = "asked";
        }
        if (mode === "existing" && detected && detected !== framework) {
          print(c.yellow(`! This looks like a ${detected} project, but you picked ${framework}. Continuing as ${framework}.`));
        }
        return result;
      },
    },
    // 7. Summary + confirm
    {
      map: 7,
      run: async (back, map) => {
        if (!product || !skills || !agents || !mode || !destDir || !framework) return fail("A question was left unanswered.");
        /** @type {Map<string, string[]>} */
        const byDir = new Map();
        for (const a of agents) {
          const { dir, label } = agentById(a);
          byDir.set(dir, [...(byDir.get(dir) ?? []), label]);
        }
        /** @type {string[]} */
        const summary = [];
        for (const [dir, labels] of byDir) {
          for (const skill of skills) {
            summary.push(c.cyan(rel(path.join(destDir, dir, skill))));
            summary.push(`  ${c.dim("copy →")} ${labels.join(", ")}`);
            summary.push("");
          }
        }
        summary.push(`${c.bold("Starter")}  ${labelOf(PRODUCTS, product)} · ${labelOf(FRAMEWORKS, framework)} · ${mode === "new" ? "new project" : "existing project"}`);
        summary.push(`  ${c.dim("→")} ${rel(destDir)}`);
        print("\n" + box("Installation Summary", summary) + "\n");
        if (flags.yes || !interactive) return "skipped";
        const answer = await select({
          message: "Proceed with installation?",
          options: [
            { value: "yes", label: "Yes, install" },
            { value: "no", label: "No, cancel", hint: "nothing is written" },
          ],
          back,
          map,
        });
        if (answer === BACK) return BACK;
        cancelled = answer === "no";
        return "asked";
      },
    },
  ];

  /** Steps that showed a prompt, newest last, with the output mark to erase back to. @type {{ step: number, at: number }[]} */
  const history = [];
  for (let i = 0; i < questions.length; ) {
    const at = mark();
    const result = await questions[i].run(history.length > 0, navMap(questions[i].map));
    if (result === BACK) {
      const prev = history.pop();
      if (prev) {
        eraseTo(prev.at);
        i = prev.step;
      }
      continue;
    }
    if (result === "asked") history.push({ step: i, at });
    i++;
  }
  if (cancelled) {
    console.log(c.dim("Nothing written."));
    return;
  }
  if (!product || !skills || !agents || !mode || !destDir || !framework) return fail("A question was left unanswered.");

  // 8. Write
  let report;
  try {
    report = scaffold({ framework, mode, destDir });
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
  const installed = installSkills(skills, agents, destDir);

  // 9. Report
  console.log(`\n${c.green("✔")} ${c.bold("Done.")}`);
  if (report.written.length) console.log(`\n${c.bold("Wrote")}\n` + report.written.map((f) => `  ${c.green("+")} ${f}`).join("\n"));
  if (report.skipped.length) console.log(`\n${c.bold("Kept your existing files")} ${c.dim("(not overwritten)")}\n` + report.skipped.map((f) => `  ${c.yellow("=")} ${f}`).join("\n"));
  console.log(`\n${c.bold(`Installed ${skills.length} skill${skills.length === 1 ? "" : "s"}`)}\n` + installed.map((f) => `  ${c.green("✓")} ${f}`).join("\n"));

  const steps = [
    ...report.nextSteps,
    `Ask your agent: ${skills.map((x) => c.cyan("/" + x)).join(c.dim(" · "))}`,
  ];
  console.log(`\n${c.bold("Next")}\n` + steps.map((s, i) => `  ${i + 1}. ${s}`).join("\n") + "\n");
}

main().catch((err) => fail(err?.stack || String(err)));
