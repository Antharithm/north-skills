// @ts-check
/**
 * prompts.mjs - tiny zero-dependency terminal prompts (select, multiselect, text).
 *
 * Arrow keys / j k to move, space to toggle (multiselect), enter to submit, ctrl+c to quit.
 * With `back: true`, ← or esc returns BACK (text prompts: esc only, since ← moves the cursor).
 * With `map`, a navigation line is shown above the question. Both disappear once answered,
 * leaving one ✔ line per question.
 * Options marked `disabled` are shown (e.g. "coming soon") but cannot be picked.
 * Every row written is counted, so a caller can eraseTo(mark()) when the user goes back.
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

/** Returned by a prompt when the user goes back. */
export const BACK = Symbol("back");

const out = process.stdout;

/** @param {string} s */
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");

/** Terminal rows the lines take up, counting long lines that wrap. @param {string[]} lines */
function rowsOf(lines) {
  const width = out.columns || 80;
  return lines.reduce((n, l) => n + Math.max(1, Math.ceil(strip(l).length / width)), 0);
}

/** Rows written by print() and answered prompts. */
let written = 0;

/** The current output position; pass it to eraseTo() later. */
export const mark = () => written;

/** Erase everything printed after `at` (used when the user goes back). @param {number} at */
export function eraseTo(at) {
  const n = written - at;
  if (n > 0) out.write(`\x1b[${n}A\x1b[J`);
  written = Math.min(written, at);
}

/** console.log that eraseTo() can undo. @param {string} [s] */
export function print(s = "") {
  out.write(s + "\n");
  written += rowsOf(s.split("\n"));
}

function cancel() {
  out.write("\x1b[?25h\n" + c.dim("Cancelled. Nothing was written.") + "\n");
  process.exit(130);
}

/** Render a list in place; returns the number of rows drawn so the next render can erase them. */
/** @param {string[]} lines @param {number} previous */
function draw(lines, previous) {
  if (previous > 0) out.write(`\x1b[${previous}A\x1b[J`);
  out.write(lines.join("\n") + "\n");
  return rowsOf(lines);
}

/** Lines shown above an open question: the navigation map, then the keys. @param {string | undefined} map @param {string[]} keys */
const guide = (map, keys) => [...(map ? [`  ${map}`] : []), `  ${c.dim(keys.join(" · "))}`];

/** @typedef {{ value: string, label: string, hint?: string, disabled?: boolean }} Option */

/**
 * @param {{ message: string, options: Option[], multiple?: boolean, initial?: string[], back?: boolean, map?: string }} opts
 * @returns {Promise<string | string[] | typeof BACK>}
 */
function listPrompt({ message, options, multiple = false, initial = [], back = false, map }) {
  return new Promise((resolve) => {
    const preferred = multiple ? -1 : options.findIndex((o) => !o.disabled && initial.includes(o.value));
    const firstEnabled = options.findIndex((o) => !o.disabled);
    let cursor = preferred !== -1 ? preferred : firstEnabled === -1 ? 0 : firstEnabled;
    const picked = new Set(multiple ? initial : []);
    let drawn = 0;
    let error = "";

    const allPreselected = multiple && options.every((o) => o.disabled || initial.includes(o.value));
    const keys = [
      ...(!multiple ? ["enter to select"] : allPreselected ? ["All selected", "enter to confirm", "space to unselect"] : ["space to select", "enter to confirm"]),
      "↑↓ move",
      ...(back ? ["← back"] : []),
    ];

    const render = (done = false) => {
      const head = `${done ? c.green("✔") : c.cyan("?")} ${c.bold(message)}`;
      if (done) {
        const chosen = options.filter((o) => (multiple ? picked.has(o.value) : o.value === options[cursor].value));
        drawn = draw([`${head} ${c.cyan(chosen.map((o) => o.label).join(", "))}`], drawn);
        written += drawn;
        return;
      }
      const lines = [...guide(map, keys), head];
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
      else if (back && (key.name === "left" || key.name === "escape")) {
        out.write(`\x1b[${drawn}A\x1b[J`);
        cleanup();
        return resolve(BACK);
      } else if (multiple && key.name === "space") {
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

/**
 * @param {{ message: string, options: Option[], initial?: string, back?: boolean, map?: string }} opts
 * @returns {Promise<string | typeof BACK>}
 */
export const select = ({ initial, ...opts }) =>
  /** @type {Promise<string | typeof BACK>} */ (listPrompt({ ...opts, initial: initial ? [initial] : [], multiple: false }));

/**
 * @param {{ message: string, options: Option[], initial?: string[], back?: boolean, map?: string }} opts
 * @returns {Promise<string[] | typeof BACK>}
 */
export const multiselect = (opts) => /** @type {Promise<string[] | typeof BACK>} */ (listPrompt({ ...opts, multiple: true }));

/**
 * @param {{ message: string, initial?: string, validate?: (value: string) => string | undefined, back?: boolean, map?: string }} opts
 * @returns {Promise<string | typeof BACK>}
 */
export function text({ message, initial = "", validate, back = false, map }) {
  return new Promise((resolve) => {
    const lead = guide(map, [initial ? `type, or enter for ${initial}` : "type, then enter", ...(back ? ["esc back"] : [])]);
    out.write(lead.join("\n") + "\n");
    /** Rows above the line being typed on. */
    let above = rowsOf(lead);
    const question = `${c.cyan("?")} ${c.bold(message)} ${initial ? c.dim(`(${initial}) `) : ""}`;

    const ask = () => {
      const rl = readline.createInterface({ input: process.stdin, output: out });
      rl.on("SIGINT", cancel);
      /** @param {string} _str @param {{ name?: string }} [key] */
      const onKey = (_str, key = {}) => {
        if (key.name !== "escape") return;
        process.stdin.off("keypress", onKey);
        rl.close();
        out.write(`\r\x1b[${above}A\x1b[J`);
        resolve(BACK);
      };
      if (back) process.stdin.on("keypress", onKey);
      rl.question(question, (answer) => {
        process.stdin.off("keypress", onKey);
        rl.close();
        above += rowsOf([question + answer]);
        const value = answer.trim() || initial;
        const problem = validate?.(value);
        if (problem) {
          const line = c.red(`  ${problem}`);
          out.write(line + "\n");
          above += rowsOf([line]);
          return ask();
        }
        const done = `${c.green("✔")} ${c.bold(message)} ${c.cyan(value)}`;
        out.write(`\x1b[${above}A\x1b[J${done}\n`);
        written += rowsOf([done]);
        resolve(value);
      });
    };
    ask();
  });
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
  const inner = Math.max(strip(title).length + 4, ...bodyLines.map((l) => strip(l).length + 2));
  const top = `◇  ${c.bold(title)} ${"─".repeat(Math.max(0, inner - strip(title).length - 1))}╮`;
  const body = bodyLines.map((l) => `│  ${l}${" ".repeat(inner - strip(l).length)}│`);
  return [top, `│${" ".repeat(inner + 2)}│`, ...body, `│${" ".repeat(inner + 2)}│`, `├${"─".repeat(inner + 2)}╯`].join("\n");
}
