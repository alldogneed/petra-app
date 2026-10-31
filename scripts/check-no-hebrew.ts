/**
 * check:i18n — fails when a MIGRATED file still contains Hebrew (U+0590–U+05FF)
 * in code. Migrated files are listed in scripts/i18n-migrated.txt (one path or
 * glob per line, `#` comments allowed). Hebrew belongs in messages/*.json only.
 *
 *   npm run check:i18n
 *
 * Ignored: comments (// and /* *\/), and any line containing `i18n-ok` (e.g. a
 * regex that must match Hebrew user input). Docs: docs/i18n.md.
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const LIST = path.join(ROOT, "scripts", "i18n-migrated.txt");
const HEBREW = /[\u0590-\u05FF]/;
/** Israel-only values that must come from the business in migrated files (CLAUDE.md "US expansion"). */
const HARDCODED = [/["'`]he-IL["'`]/, /["'`]ILS["'`]/, /["'`]Asia\/Jerusalem["'`]/, /\u20AA/, /from ["']date-fns\/locale["']/];

function globToRegex(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      re += ".*";
      i++;
      if (glob[i + 1] === "/") i++;
    } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

function walk(dir: string, out: string[]) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?|mjs)$/.test(e.name)) out.push(path.relative(ROOT, p));
  }
}

/** Replace comments with spaces (keeps line numbers); strings/JSX text untouched. */
function stripComments(src: string): string {
  let out = "";
  let i = 0;
  let quote: string | null = null;
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (quote) {
      out += c;
      if (c === "\\") { out += d ?? ""; i += 2; continue; }
      if (c === quote || (c === "\n" && quote !== "`")) quote = null;
      i++;
      continue;
    }
    if (c === "/" && d === "/") {
      while (i < src.length && src[i] !== "\n") { out += " "; i++; }
      continue;
    }
    if (c === "/" && d === "*") {
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) { out += src[i] === "\n" ? "\n" : " "; i++; }
      out += "  ";
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") quote = c;
    out += c;
    i++;
  }
  return out;
}

type Tree = { [k: string]: string | Tree };

function flatten(t: Tree, prefix = "", out: Record<string, string> = {}) {
  for (const [k, v] of Object.entries(t)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else flatten(v, key, out);
  }
  return out;
}

/** {name} / {count, plural, …} argument names of an ICU message. */
function argNames(msg: string): string[] {
  const names = new Set<string>();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { parse } = require("@formatjs/icu-messageformat-parser");
  const visit = (els: Array<{ type: number; value?: string; options?: Record<string, { value: unknown[] }>; children?: unknown[] }>) => {
    for (const el of els) {
      if (el.value && el.type !== 0 && el.type !== 7) names.add(el.value);
      if (el.options) for (const o of Object.values(el.options)) visit(o.value as never);
      if (el.children) visit(el.children as never);
    }
  };
  visit(parse(msg, { ignoreTag: false }));
  return Array.from(names).sort();
}

/** he.json ↔ en.json: same keys, valid ICU, same arguments. */
function checkMessages(): number {
  const load = (l: string) => JSON.parse(fs.readFileSync(path.join(ROOT, "messages", `${l}.json`), "utf8")) as Tree;
  const he = flatten(load("he"));
  const en = flatten(load("en"));
  let bad = 0;
  for (const k of Object.keys(he)) if (!(k in en)) { bad++; console.error(`messages: "${k}" missing in en.json`); }
  for (const k of Object.keys(en)) if (!(k in he)) { bad++; console.error(`messages: "${k}" missing in he.json`); }
  for (const [k, v] of Object.entries(he)) {
    try {
      const a = argNames(v);
      if (k in en) {
        const b = argNames(en[k]);
        if (a.join() !== b.join()) { bad++; console.error(`messages: "${k}" arguments differ he=[${a}] en=[${b}]`); }
      }
    } catch (e) {
      bad++;
      console.error(`messages: "${k}" invalid ICU in he.json — ${(e as Error).message}`);
    }
  }
  for (const [k, v] of Object.entries(en)) {
    try { argNames(v); } catch (e) { bad++; console.error(`messages: "${k}" invalid ICU in en.json — ${(e as Error).message}`); }
  }
  return bad;
}

function main() {
  if (!fs.existsSync(LIST)) {
    console.error(`missing ${path.relative(ROOT, LIST)}`);
    process.exit(2);
  }
  const patterns = fs
    .readFileSync(LIST, "utf8")
    .split("\n")
    .map((l) => l.replace(/#.*/, "").trim())
    .filter(Boolean);
  const all: string[] = [];
  walk(path.join(ROOT, "src"), all);
  const files = new Set<string>();
  const unmatched: string[] = [];
  for (const p of patterns) {
    if (!/[*?]/.test(p)) {
      if (fs.existsSync(path.join(ROOT, p))) files.add(p);
      else unmatched.push(p);
      continue;
    }
    const re = globToRegex(p);
    const hits = all.filter((f) => re.test(f));
    if (!hits.length) unmatched.push(p);
    hits.forEach((f) => files.add(f));
  }
  let problems = 0;
  for (const f of Array.from(files).sort()) {
    if (f.startsWith("messages/")) continue;
    const lines = stripComments(fs.readFileSync(path.join(ROOT, f), "utf8")).split("\n");
    const raw = fs.readFileSync(path.join(ROOT, f), "utf8").split("\n");
    lines.forEach((line, idx) => {
      if (/i18n-ok/.test(raw[idx] ?? "")) return;
      if (HEBREW.test(line)) {
        problems++;
        console.error(`${f}:${idx + 1}: ${line.trim().slice(0, 120)}`);
      }
      const hard = HARDCODED.find((re) => re.test(line));
      if (hard) {
        problems++;
        console.error(`${f}:${idx + 1}: hardcoded locale value (${hard.source}) — use the business locale (src/lib/format.ts, useBusinessLocale)`);
      }
    });
  }
  problems += checkMessages();
  for (const p of unmatched) console.error(`i18n-migrated.txt: "${p}" matches no file`);
  if (problems || unmatched.length) {
    console.error(`\ncheck:i18n FAILED — ${problems} Hebrew line(s) in migrated files${unmatched.length ? `, ${unmatched.length} stale entr(ies)` : ""}`);
    process.exit(1);
  }
  console.log(`check:i18n OK — ${files.size} migrated file(s), no Hebrew outside messages/`);
}

main();
