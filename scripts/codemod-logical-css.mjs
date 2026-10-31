#!/usr/bin/env node
/**
 * codemod-logical-css — physical Tailwind direction classes → logical ones.
 *
 *   node scripts/codemod-logical-css.mjs --dry-run <files…>   (prints a diff, default)
 *   node scripts/codemod-logical-css.mjs --write   <files…>
 *   node scripts/codemod-logical-css.mjs --json    <files…>   (counts per file, for PROGRESS.md)
 *
 * IMPORTANT — the mapping is MIRRORED (docs/us-expansion/DECISIONS.md D-003):
 * Petra was authored right-to-left, so a physical "left" in today's UI is the
 * inline END and a physical "right" is the inline START. Mapping ml→me keeps
 * every Hebrew screen pixel-identical and makes the English (LTR) screen the
 * mirror image, which is what we want.
 *
 *   ml-*  → me-*      mr-*  → ms-*      pl-*  → pe-*      pr-*  → ps-*
 *   left-* → end-*    right-* → start-*
 *   text-left → text-end              text-right → text-start
 *   float-left → float-end            float-right → float-start
 *   clear-left → clear-end            clear-right → clear-start
 *   rounded-l* → rounded-e*           rounded-r* → rounded-s*
 *   rounded-tl → rounded-se  rounded-tr → rounded-ss  rounded-bl → rounded-ee  rounded-br → rounded-es
 *   border-l* → border-e*             border-r* → border-s*
 *   scroll-ml/mr/pl/pr → scroll-me/ms/pe/ps
 *   "space-x-N … space-x-reverse" (RTL hack) → "space-x-N … rtl:space-x-reverse"
 *
 * Works on every string / template literal (className, cn(), cva, variables…),
 * token by token — a token is rewritten only when it is exactly one of the
 * classes above (any variant prefix like md: / hover: / group-hover:, optional
 * "!" and "-" for negatives, arbitrary values like left-[3px]).
 *
 * Skipped:
 *   - tokens that already carry an rtl: / ltr: variant (intentional)
 *   - any literal on a line containing "rtl-ok"
 *   - literals inside a JSX opening tag that has dir="ltr" (phones, code)
 *   - translate-x / rotate / gradients / inline styles — NOT directional in
 *     Tailwind's logical sense; reported as "manual" for QA.
 */
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const mode = args.includes("--write") ? "write" : args.includes("--json") ? "json" : "dry";
const files = args.filter((a) => !a.startsWith("--"));
if (!files.length) {
  console.error("usage: codemod-logical-css.mjs [--dry-run|--write|--json] <files…>");
  process.exit(2);
}

// core (without variants / ! / leading -) → replacement core
const RULES = [
  [/^m([lr])-(.+)$/, (m) => `m${m[1] === "l" ? "e" : "s"}-${m[2]}`],
  [/^p([lr])-(.+)$/, (m) => `p${m[1] === "l" ? "e" : "s"}-${m[2]}`],
  [/^scroll-([mp])([lr])-(.+)$/, (m) => `scroll-${m[1]}${m[2] === "l" ? "e" : "s"}-${m[3]}`],
  [/^left-(.+)$/, (m) => `end-${m[1]}`],
  [/^right-(.+)$/, (m) => `start-${m[1]}`],
  [/^(text|float|clear)-(left|right)$/, (m) => `${m[1]}-${m[2] === "left" ? "end" : "start"}`],
  [/^rounded-(tl|tr|bl|br)(-.+)?$/, (m) => `rounded-${{ tl: "se", tr: "ss", bl: "ee", br: "es" }[m[1]]}${m[2] ?? ""}`],
  [/^rounded-([lr])(-.+)?$/, (m) => `rounded-${m[1] === "l" ? "e" : "s"}${m[2] ?? ""}`],
  [/^border-([lr])(-.+)?$/, (m) => `border-${m[1] === "l" ? "e" : "s"}${m[2] ?? ""}`],
];
const MANUAL = /(^|:)-?(translate-x|rotate|bg-gradient-to-[lr]|from-|origin-(left|right)|-?skew-x)/;

function convertToken(tok) {
  // split variants: everything up to the last ":" that is not inside [...]
  let depth = 0, cut = -1;
  for (let i = 0; i < tok.length; i++) {
    const c = tok[i];
    if (c === "[") depth++;
    else if (c === "]") depth--;
    else if (c === ":" && depth === 0) cut = i;
  }
  const variants = tok.slice(0, cut + 1);
  let core = tok.slice(cut + 1);
  if (/(^|:)(rtl|ltr):/.test(variants) || /^(rtl|ltr):/.test(variants)) return null;
  let bang = "";
  if (core.startsWith("!")) { bang = "!"; core = core.slice(1); }
  let neg = "";
  if (core.startsWith("-")) { neg = "-"; core = core.slice(1); }
  for (const [re, fn] of RULES) {
    const m = core.match(re);
    if (m) return `${variants}${bang}${neg}${fn(m)}`;
  }
  return null;
}

/** Returns [newText, changes[], manual[]] for one literal body. */
function convertLiteral(body) {
  const changes = [];
  const manual = [];
  // only whitespace-separated runs outside ${…}
  let out = "";
  let i = 0;
  while (i < body.length) {
    if (body[i] === "$" && body[i + 1] === "{") {
      // copy the expression verbatim (nested literals are visited separately)
      let depth = 0, j = i;
      for (; j < body.length; j++) {
        if (body[j] === "{") depth++;
        else if (body[j] === "}") { depth--; if (depth === 0) break; }
      }
      out += body.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    const m = /^[^\s$]+|^\$(?!\{)/.exec(body.slice(i));
    if (m && !/\s/.test(body[i])) {
      const tok = m[0];
      const conv = convertToken(tok);
      if (conv && conv !== tok) { changes.push([tok, conv]); out += conv; }
      else {
        if (MANUAL.test(tok) && /translate-x|rotate|gradient|origin|skew/.test(tok) && !/(rtl|ltr):/.test(tok)) manual.push(tok);
        out += tok;
      }
      i += tok.length;
    } else {
      out += body[i];
      i++;
    }
  }
  // RTL space-x hack → explicit rtl: variant
  if (/(^|\s)space-x-\S+/.test(out) && /(^|\s)space-x-reverse(\s|$)/.test(out)) {
    out = out.replace(/(^|\s)space-x-reverse(?=\s|$)/g, (_, pre) => { changes.push(["space-x-reverse", "rtl:space-x-reverse"]); return `${pre}rtl:space-x-reverse`; });
  }
  return [out, changes, manual];
}

/** Walk the source, visit every '…' "…" `…` literal outside comments. */
function processSource(src) {
  const changes = [];
  const manual = [];
  let out = "";
  let i = 0;
  const n = src.length;
  const lineAt = (pos) => {
    const s = src.lastIndexOf("\n", pos - 1) + 1;
    const e = src.indexOf("\n", pos);
    return src.slice(s, e === -1 ? n : e);
  };
  const inLtrTag = (pos) => {
    const lt = src.lastIndexOf("<", pos);
    if (lt === -1) return false;
    const gt = src.indexOf(">", pos);
    const tag = src.slice(lt, gt === -1 ? n : gt);
    // a JSX opening tag never contains a newline-terminated statement end; keep it cheap
    return /dir=["']ltr["']|dir=\{["']ltr["']\}/.test(tag) && !/[;]\s*\n/.test(src.slice(lt, pos));
  };
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];
    if (c === "/" && c2 === "/") { const e = src.indexOf("\n", i); const end = e === -1 ? n : e; out += src.slice(i, end); i = end; continue; }
    if (c === "/" && c2 === "*") { const e = src.indexOf("*/", i + 2); const end = e === -1 ? n : e + 2; out += src.slice(i, end); i = end; continue; }
    if (c === '"' || c === "'" || c === "`") {
      // find the closing quote (template: track ${} nesting crudely)
      let j = i + 1, depth = 0;
      for (; j < n; j++) {
        const d = src[j];
        if (d === "\\") { j++; continue; }
        if (c === "`") {
          if (d === "$" && src[j + 1] === "{") { depth++; j++; continue; }
          if (d === "}" && depth > 0) { depth--; continue; }
          if (d === "`" && depth === 0) break;
        } else if (d === c || d === "\n") break;
      }
      const body = src.slice(i + 1, j);
      const skip = /rtl-ok/.test(lineAt(i)) || inLtrTag(i);
      if (skip) { out += src.slice(i, j + 1); }
      else {
        const [nb, ch, man] = convertLiteral(body);
        for (const x of ch) changes.push({ line: src.slice(0, i).split("\n").length, from: x[0], to: x[1] });
        for (const x of man) manual.push({ line: src.slice(0, i).split("\n").length, token: x });
        out += c + nb + (j < n ? src[j] : "");
      }
      i = j + 1;
      continue;
    }
    out += c;
    i++;
  }
  return { out, changes, manual };
}

const report = {};
let total = 0;
for (const f of files) {
  const abs = path.resolve(f);
  const src = fs.readFileSync(abs, "utf8");
  const { out, changes, manual } = processSource(src);
  total += changes.length;
  report[f] = { replacements: changes.length, manual: manual.length };
  if (mode === "dry") {
    for (const ch of changes) console.log(`${f}:${ch.line}  ${ch.from} → ${ch.to}`);
    for (const m of manual) console.log(`${f}:${m.line}  MANUAL ${m.token}`);
  } else if (mode === "write" && out !== src) {
    fs.writeFileSync(abs, out);
  }
  if (mode !== "json") {
    console.error(`${f}: ${changes.length} replacements, ${manual.length} manual`);
  }
}
if (mode === "json") console.log(JSON.stringify({ total, files: report }, null, 2));
else console.error(`total: ${total} replacements in ${files.length} file(s)`);
