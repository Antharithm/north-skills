/**
 * prompts.mjs - tiny zero-dependency terminal prompts (select, multiselect, text, confirm).
 *
 * Arrow keys / j k to move, space to toggle (multiselect), enter to submit, ctrl+c to quit.
 * Options marked `disabled` are shown (e.g. "coming soon") but cannot be picked.
 */

import readline from "node:readline";

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
function draw(lines, previous) {
  if (previous > 0) out.write(`\x1b[${previous}A\x1b[J`);
  out.write(lines.join("\n") + "\n");
  return lines.length;
}

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

    const move = (step) => {
      for (let n = 0; n < options.length; n++) {
        cursor = (cursor + step + options.length) % options.length;
        if (!options[cursor].disabled) break;
      }
    };

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

export const select = (opts) => listPrompt({ ...opts, multiple: false });
export const multiselect = (opts) => listPrompt({ ...opts, multiple: true });

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

export async function confirm({ message, initial = true }) {
  const answer = await text({ message: `${message} ${c.dim(initial ? "[Y/n]" : "[y/N]")}` });
  if (!answer) return initial;
  return /^y(es)?$/i.test(answer);
}
