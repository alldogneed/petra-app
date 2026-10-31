#!/usr/bin/env node
/**
 * extract-hebrew — lists every Hebrew string in a file so it can be moved to
 * messages/he.json VERBATIM (copy, never retype).
 *
 *   node scripts/extract-hebrew.mjs <file…>          → JSON on stdout
 *   node scripts/extract-hebrew.mjs --count <file…>  → "<n> <file>" per file
 *
 * Kinds: "jsx-text" (text between tags, trimmed — `raw` keeps the exact
 * source), "string" ('…' / "…"), "template" (`…${x}…` — `parts` has the
 * static chunks, `exprs` the ${…} sources), "jsx-attr" (attr="…"), "comment".
 */
import fs from "node:fs";
import ts from "typescript";

const args = process.argv.slice(2);
const countOnly = args.includes("--count");
const files = args.filter((a) => !a.startsWith("--"));
const HEBREW = /[\u0590-\u05FF]/;

function extract(file) {
  const src = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const items = [];
  const line = (pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;
  const visit = (node) => {
    if (ts.isJsxText(node)) {
      const raw = node.getText(sf);
      if (HEBREW.test(raw)) items.push({ line: line(node.getStart(sf)), kind: "jsx-text", text: raw.replace(/\s+/g, " ").trim(), raw });
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (HEBREW.test(node.text)) {
        const parent = node.parent;
        const kind = parent && ts.isJsxAttribute(parent) ? "jsx-attr" : ts.isNoSubstitutionTemplateLiteral(node) ? "template" : "string";
        const item = { line: line(node.getStart(sf)), kind, text: node.text };
        if (kind === "jsx-attr") item.attr = parent.name.getText(sf);
        items.push(item);
      }
      return;
    } else if (ts.isTemplateExpression(node)) {
      const parts = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)];
      if (parts.some((p) => HEBREW.test(p))) {
        items.push({
          line: line(node.getStart(sf)),
          kind: "template",
          parts,
          exprs: node.templateSpans.map((s) => s.expression.getText(sf)),
          source: node.getText(sf),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  // comments (informational — check:i18n ignores them)
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, sf.languageVariant, src);
  let tok;
  while ((tok = scanner.scan()) !== ts.SyntaxKind.EndOfFileToken) {
    if ((tok === ts.SyntaxKind.SingleLineCommentTrivia || tok === ts.SyntaxKind.MultiLineCommentTrivia) && HEBREW.test(scanner.getTokenText())) {
      items.push({ line: line(scanner.getTokenPos()), kind: "comment", text: scanner.getTokenText() });
    }
  }
  items.sort((a, b) => a.line - b.line);
  return items;
}

if (!files.length) {
  console.error("usage: extract-hebrew.mjs [--count] <file…>");
  process.exit(2);
}
if (countOnly) {
  for (const f of files) console.log(`${extract(f).filter((i) => i.kind !== "comment").length} ${f}`);
} else {
  const out = {};
  for (const f of files) out[f] = extract(f);
  console.log(JSON.stringify(out, null, 2));
}
