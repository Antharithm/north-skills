// @ts-check
/**
 * prompts.mjs - tiny zero-dependency terminal prompts (select, multiselect, text, confirm).
 *
 * Arrow keys / j k to move, space to toggle (multiselect), enter to submit, ctrl+c to quit.
 * Options marked `disabled` are shown (e.g. "coming soon") but cannot be picked.
 */

import readline from "node:readline";

/** @type {Record<"dim" | "bold" | "cyan" | "green" | "yellow" | "red", (s: string) => string>} */
const c = {
  dim: (s) => `\x1b[2m${s}\x1b[22m`,
  bold: (s) => `\x1b[1m${s}\x1b[22m`,
  cyan: (s) => `\x1b[36m${s}\x1b[39m`,
  green: (s) => `\x1b[32m${s}\x1b[39m`,
  yellow: (s) => `\x1b[33m${s}\x1b[39m`,
  red: (s) => `\x1b[31m${s}\x1b[39m`,
};
export const color = c;

const out = process.stdout;

function cancel() {
  out.write("\x1b[?25h\n" + c.dim("Cancelled. Nothing was written.") + "\n");
  process.exit(130);
}

/** Render a list in place; returns the number of lines drawn so the next render can erase them. */
/** @param {string[]} lines @param {number} previous */
function draw(lines, previous) {
  if (previous > 0) out.write(`\x1b[${previous}A\x1b[J`);
  out.write(lines.join("\n") + "\n");
  return lines.length;
}

/** @typedef {{ value: string, label: string, hint?: string, disabled?: boolean }} Option */

/**
 * @param {{ message: string, options: Option[], multiple?: boolean, initial?: string[] }} opts
 * @returns {Promise<string | string[]>}
 */
function listPrompt({ message, options, multiple = false, initial = [] }) {
  return new Promise((resolve) => {
    const firstEnabled = options.findIndex((o) => !o.disabled);
    let cursor = firstEnabled === -1 ? 0 : firstEnabled;
    const picked = new Set(initial);
    let drawn = 0;
    let error = "";

    const render = (done = false) => {
      const head = `${done ? c.green("✔") : c.cyan("?")} ${c.bold(message)}`;
      if (done) {
        const chosen = options.filter((o) => (multiple ? picked.has(o.value) : o.value === options[cursor].value));
        drawn = draw([`${head} ${c.cyan(chosen.map((o) => o.label).join(", "))}`], drawn);
        return;
      }
      const help = multiple ? "↑/↓ move · space select · enter confirm" : "↑/↓ move · enter select";
      const lines = [`${head} ${c.dim(help)}`];
      options.forEach((o, i) => {
        const pointer = i === cursor ? c.cyan("›") : " ";
        const box = multiple ? (picked.has(o.value) ? c.green("◉") : "◯") + " " : "";
        const label = o.disabled ? c.dim(`${o.label}${o.hint ? `  ${o.hint}` : ""}`) : i === cursor ? c.cyan(o.label) : o.label;
        const hint = !o.disabled && o.hint ? "  " + c.dim(o.hint) : "";
        lines.push(`${pointer} ${box}${label}${hint}`);
      });
      if (error) lines.push(c.red(error));
      drawn = draw(lines, drawn);
    };

    /** @param {number} step */
    const move = (step) => {
      for (let n = 0; n < options.length; n++) {
        cursor = (cursor + step + options.length) % options.length;
        if (!options[cursor].disabled) break;
      }
    };

    /** @param {string} _str @param {{ name?: string, ctrl?: boolean }} [key] */
    const onKey = (_str, key = {}) => {
      error = "";
      if (key.ctrl && key.name === "c") return cancel();
      if (key.name === "up" || key.name === "k") move(-1);
      else if (key.name === "down" || key.name === "j") move(1);
      else if (multiple && key.name === "space") {
        const v = options[cursor].value;
        picked.has(v) ? picked.delete(v) : picked.add(v);
      } else if (key.name === "return") {
        if (multiple && picked.size === 0) error = "Pick at least one (space to select).";
        else {
          render(true);
          cleanup();
          return resolve(multiple ? [...picked] : options[cursor].value);
        }
      }
      render();
    };

    const cleanup = () => {
      process.stdin.off("keypress", onKey);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdin.pause();
      out.write("\x1b[?25h");
    };

    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();
    out.write("\x1b[?25l");
    process.stdin.on("keypress", onKey);
    render();
  });
}

/** @param {{ message: string, options: Option[] }} opts @returns {Promise<string>} */
export const select = (opts) => /** @type {Promise<string>} */ (listPrompt({ ...opts, multiple: false }));
/** @param {{ message: string, options: Option[], initial?: string[] }} opts @returns {Promise<string[]>} */
export const multiselect = (opts) => /** @type {Promise<string[]>} */ (listPrompt({ ...opts, multiple: true }));

/**
 * @param {{ message: string, initial?: string, validate?: (value: string) => string | undefined }} opts
 * @returns {Promise<string>}
 */
export function text({ message, initial = "", validate }) {
  return new Promise((resolve) => {
    const ask = () => {
      const rl = readline.createInterface({ input: process.stdin, output: out });
      rl.on("SIGINT", cancel);
      rl.question(`${c.cyan("?")} ${c.bold(message)} ${initial ? c.dim(`(${initial}) `) : ""}`, (answer) => {
        rl.close();
        const value = answer.trim() || initial;
        const problem = validate?.(value);
        if (problem) {
          out.write(c.red(`  ${problem}`) + "\n");
          return ask();
        }
        resolve(value);
      });
    };
    ask();
  });
}

/** @param {{ message: string, initial?: boolean }} opts @returns {Promise<boolean>} */
export async function confirm({ message, initial = true }) {
  const answer = await text({ message: `${message} ${c.dim(initial ? "[Y/n]" : "[y/N]")}` });
  if (!answer) return initial;
  return /^y(es)?$/i.test(answer);
}

// ---- Banner ---------------------------------------------------------------------

/** @type {Record<string, string[]>} */
const FONT = {
  N: ["█   █", "██  █", "█ █ █", "█  ██", "█   █"],
  O: [" ███ ", "█   █", "█   █", "█   █", " ███ "],
  R: ["████ ", "█   █", "████ ", "█  █ ", "█   █"],
  T: ["█████", "  █  ", "  █  ", "  █  ", "  █  "],
  H: ["█   █", "█   █", "█████", "█   █", "█   █"],
};

/** Big block-letter word with a top-to-bottom grey gradient and a drop shadow. */
export function banner(word = "NORTH") {
  const color = process.stdout.isTTY && !process.env.NO_COLOR;
  const rows = 5;
  const grid = Array.from({ length: rows }, (_, r) => [...word].map((ch) => FONT[ch][r] + " ").join(""));
  const width = grid[0].length + 1;
  /** @param {number} r @param {number} c */
  const filled = (r, c) => r >= 0 && r < rows && grid[r][c] === "█";
  const shades = [255, 251, 248, 245, 242];
  const lines = [];
  for (let r = 0; r <= rows; r++) {
    let line = "";
    for (let c = 0; c < width; c++) {
      if (filled(r, c)) line += color ? `\x1b[38;5;${shades[r]}m██\x1b[39m` : "██";
      else if (filled(r - 1, c - 1)) line += color ? "\x1b[38;5;238m░░\x1b[39m" : "░░";
      else line += "  ";
    }
    lines.push(line.replace(/\s+$/, ""));
  }
  return lines.join("\n");
}

/** A rounded box with a title, like an installation summary. */
/** @param {string} title @param {string[]} bodyLines */
export function box(title, bodyLines) {
  /** @param {string} s */
  const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
  const inner = Math.max(strip(title).length + 4, ...bodyLines.map((l) => strip(l).length + 2));
  const top = `◇  ${c.bold(title)} ${"─".repeat(Math.max(0, inner - strip(title).length - 1))}╮`;
  const body = bodyLines.map((l) => `│  ${l}${" ".repeat(inner - strip(l).length)}│`);
  return [top, `│${" ".repeat(inner + 2)}│`, ...body, `│${" ".repeat(inner + 2)}│`, `├${"─".repeat(inner + 2)}╯`].join("\n");
}
