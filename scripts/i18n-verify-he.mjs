#!/usr/bin/env node
/**
 * i18n-verify-he — proves the Hebrew moved to messages/he.json is VERBATIM.
 *
 *   node scripts/i18n-verify-he.mjs [--base origin/main] <file…>
 *
 * For each file, every Hebrew chunk of the BASE version (git show <base>:<file>)
 * — JSX text, string literals and the static parts of template literals — must
 * appear (whitespace-normalised) inside some value of messages/he.json, or
 * still be present in the current file (e.g. a comment, or an `i18n-ok` line).
 * A chunk = text between interpolations, so `שלום ${name}!` is checked as
 * "שלום" and "!" separately (punctuation-only chunks are skipped).
 * Exit 1 lists every chunk that was changed / retyped / dropped.
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const args = process.argv.slice(2);
let base = "origin/main";
const bi = args.indexOf("--base");
if (bi !== -1) { base = args[bi + 1]; args.splice(bi, 2); }
const files = args;
const HEBREW = /[\u0590-\u05FF]/;
const norm = (s) => s.replace(/\s+/g, " ").trim();

function chunks(src, file) {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out = [];
  const add = (s, line) => {
    const t = norm(s);
    if (HEBREW.test(t)) out.push({ text: t, line });
  };
  const visit = (node) => {
    const line = () => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    if (ts.isJsxText(node)) add(node.getText(sf), line());
    else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) { add(node.text, line()); return; }
    else if (ts.isTemplateExpression(node)) {
      add(node.head.text, line());
      node.templateSpans.forEach((s) => add(s.literal.text, line()));
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

function flatten(t, out = []) {
  for (const v of Object.values(t)) typeof v === "string" ? out.push(v) : flatten(v, out);
  return out;
}

const heTrees = [JSON.parse(fs.readFileSync("messages/he.json", "utf8"))];
// not-yet-merged agent fragments: I18N_FRAGMENTS=a.json,b.json
for (const f of (process.env.I18N_FRAGMENTS || "").split(",").filter(Boolean)) heTrees.push(JSON.parse(fs.readFileSync(f, "utf8")).he || {});
const he = heTrees.flatMap((t) => flatten(t)).map(norm);
// ICU: '' is a literal apostrophe; compare against the unescaped form too
const heUnescaped = he.map((v) => v.replace(/''/g, "'"));
const haystack = he.join("\n") + "\n" + heUnescaped.join("\n");

let missing = 0;
let checked = 0;
for (const f of files) {
  let baseSrc;
  try {
    baseSrc = execFileSync("git", ["show", `${base}:${f}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch {
    console.error(`${f}: not in ${base} (new file) — skipped`);
    continue;
  }
  const current = fs.existsSync(f) ? norm(fs.readFileSync(f, "utf8")) : "";
  for (const c of chunks(baseSrc, f)) {
    checked++;
    // ICU placeholders split JSX text like "שלום {name}" — test each Hebrew run between braces
    const pieces = c.text.split(/\{[^}]*\}/).map(norm).filter((p) => HEBREW.test(p));
    for (const p of pieces) {
      if (haystack.includes(p) || current.includes(p)) continue;
      missing++;
      console.error(`${f}:${c.line} (base): "${p}" not found verbatim in messages/he.json`);
    }
  }
}
if (missing) {
  console.error(`\ni18n-verify-he FAILED — ${missing} Hebrew chunk(s) changed or missing (of ${checked})`);
  process.exit(1);
}
console.log(`i18n-verify-he OK — ${checked} Hebrew chunk(s) from ${base} found verbatim`);
