#!/usr/bin/env node
/**
 * i18n-check-keys — every t("…") used in code must exist in messages/he.json.
 *
 *   node scripts/i18n-check-keys.mjs [<file…>]     (default: files of scripts/i18n-migrated.txt)
 *   I18N_FRAGMENTS=a.json,b.json node scripts/i18n-check-keys.mjs <file>
 *       → also accept keys from not-yet-merged agent fragments
 *
 * Understands: const t = useTranslations("ns") | await getTranslations("ns")
 * | await getTranslations({ namespace: "ns", … }), and calls t("k"),
 * t.rich/markup/raw/has("k"). A template key t(`a.${x}`) checks that the
 * object "ns.a" exists. Keys held in variables are listed as "dynamic" (info).
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const he = read("messages/he.json");
for (const f of (process.env.I18N_FRAGMENTS || "").split(",").filter(Boolean)) {
  const d = read(f);
  const merge = (t, s) => { for (const [k, v] of Object.entries(s)) { if (typeof v === "object") { t[k] = typeof t[k] === "object" ? t[k] : {}; merge(t[k], v); } else if (t[k] === undefined) t[k] = v; } };
  merge(he, d.he || {});
}

function lookup(pathStr) {
  let cur = he;
  for (const part of pathStr.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[part];
  }
  return cur;
}

function globToRegex(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") { re += ".*"; i++; if (glob[i + 1] === "/") i++; }
    else if (c === "*") re += "[^/]*";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}
function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?)$/.test(e.name)) out.push(path.relative(ROOT, p));
  }
}

let files = process.argv.slice(2);
if (!files.length) {
  const pats = fs.readFileSync("scripts/i18n-migrated.txt", "utf8").split("\n").map((l) => l.replace(/#.*/, "").trim()).filter(Boolean);
  const all = [];
  walk(path.join(ROOT, "src"), all);
  const set = new Set();
  for (const p of pats) {
    if (!/[*?]/.test(p)) { if (fs.existsSync(p)) set.add(p); continue; }
    const re = globToRegex(p);
    all.filter((f) => re.test(f)).forEach((f) => set.add(f));
  }
  files = [...set];
}

let missing = 0, dynamic = 0, used = 0;
for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const nsOf = new Map(); // translator variable name → namespace ("" = root)
  const nsFromCall = (call) => {
    const callee = call.expression.getText(sf);
    if (!/^(useTranslations|getTranslations)$/.test(callee)) return null;
    const a = call.arguments[0];
    if (!a) return "";
    if (ts.isStringLiteral(a)) return a.text;
    if (ts.isObjectLiteralExpression(a)) {
      const p = a.properties.find((x) => x.name && x.name.getText(sf) === "namespace");
      if (p && ts.isPropertyAssignment(p) && ts.isStringLiteral(p.initializer)) return p.initializer.text;
      return "";
    }
    return null;
  };
  const findDecls = (node) => {
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isIdentifier(node.name)) {
      let init = node.initializer;
      if (ts.isAwaitExpression(init)) init = init.expression;
      if (ts.isCallExpression(init)) {
        const ns = nsFromCall(init);
        if (ns !== null) nsOf.set(node.name.text, ns);
      }
    }
    ts.forEachChild(node, findDecls);
  };
  findDecls(sf);
  const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      let callee = node.expression;
      let method = "";
      if (ts.isPropertyAccessExpression(callee) && ["rich", "markup", "raw", "has"].includes(callee.name.text)) {
        method = callee.name.text;
        callee = callee.expression;
      }
      if (ts.isIdentifier(callee) && nsOf.has(callee.text)) {
        const ns = nsOf.get(callee.text);
        const arg = node.arguments[0];
        const full = (k) => (ns ? `${ns}.${k}` : k);
        if (arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg))) {
          used++;
          const v = lookup(full(arg.text));
          if (method !== "has" && v === undefined) { missing++; console.error(`${file}:${line(node)}: missing key "${full(arg.text)}"`); }
          else if (method !== "raw" && method !== "has" && typeof v === "object") { missing++; console.error(`${file}:${line(node)}: "${full(arg.text)}" is an object, not a message`); }
        } else if (arg && ts.isTemplateExpression(arg)) {
          used++;
          const prefix = arg.head.text.replace(/\.$/, "");
          if (prefix && typeof lookup(full(prefix)) !== "object") { missing++; console.error(`${file}:${line(node)}: dynamic key prefix "${full(prefix)}" is not an object in messages`); }
          else dynamic++;
        } else if (arg) {
          dynamic++;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}
if (missing) {
  console.error(`\ni18n-check-keys FAILED — ${missing} missing key(s)`);
  process.exit(1);
}
console.log(`i18n-check-keys OK — ${files.length} file(s), ${used} static key use(s), ${dynamic} dynamic`);
