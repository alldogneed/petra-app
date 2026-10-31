#!/usr/bin/env node
/**
 * i18n-merge-fragments — merges per-agent message fragments into
 * messages/he.json + messages/en.json.
 *
 *   node scripts/i18n-merge-fragments.mjs [--check] <fragment.json…>
 *
 * Fragment format (one per migrated file / agent):
 *   { "he": { "<namespace>": { …nested keys… } }, "en": { …same shape… } }
 *
 * Rules: a key that already exists with the SAME value is fine (shared
 * `common` keys); the same key with a DIFFERENT value is a conflict → exit 1,
 * nothing written. he/en of a fragment must have the same key set.
 * --check validates only (no write).
 */
import fs from "node:fs";

const args = process.argv.slice(2);
const check = args.includes("--check");
const frags = args.filter((a) => !a.startsWith("--"));

const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const he = read("messages/he.json");
const en = read("messages/en.json");

function keys(t, pre = "", out = new Set()) {
  for (const [k, v] of Object.entries(t)) {
    const kk = pre ? `${pre}.${k}` : k;
    if (typeof v === "string") out.add(kk);
    else keys(v, kk, out);
  }
  return out;
}

let conflicts = 0;
let added = 0;
function merge(target, src, where, pre = "") {
  for (const [k, v] of Object.entries(src)) {
    const kk = pre ? `${pre}.${k}` : k;
    if (typeof v === "string") {
      if (typeof target[k] === "object") { conflicts++; console.error(`${where}: "${kk}" is a string here but an object in messages`); continue; }
      if (target[k] === undefined) { target[k] = v; added++; }
      else if (target[k] !== v) { conflicts++; console.error(`${where}: "${kk}" conflict:\n   existing: ${JSON.stringify(target[k])}\n   fragment: ${JSON.stringify(v)}`); }
    } else if (v && typeof v === "object") {
      if (typeof target[k] === "string") { conflicts++; console.error(`${where}: "${kk}" is an object here but a string in messages`); continue; }
      target[k] = target[k] ?? {};
      merge(target[k], v, where, kk);
    }
  }
}

for (const f of frags) {
  const d = read(f);
  if (!d.he || !d.en) { conflicts++; console.error(`${f}: needs top-level "he" and "en"`); continue; }
  const a = keys(d.he), b = keys(d.en);
  for (const k of a) if (!b.has(k)) { conflicts++; console.error(`${f}: "${k}" has no en`); }
  for (const k of b) if (!a.has(k)) { conflicts++; console.error(`${f}: "${k}" has no he`); }
  merge(he, d.he, `${f} [he]`);
  merge(en, d.en, `${f} [en]`);
}

if (conflicts) {
  console.error(`\nmerge FAILED — ${conflicts} problem(s); messages/*.json not written`);
  process.exit(1);
}
if (!check) {
  // namespaces sorted for stable diffs; keys keep insertion order inside a namespace
  const sortTop = (o) => Object.fromEntries(Object.keys(o).sort((x, y) => (x === "common" ? -1 : y === "common" ? 1 : x.localeCompare(y))).map((k) => [k, o[k]]));
  fs.writeFileSync("messages/he.json", JSON.stringify(sortTop(he), null, 2) + "\n");
  fs.writeFileSync("messages/en.json", JSON.stringify(sortTop(en), null, 2) + "\n");
}
console.log(`merge ${check ? "check " : ""}OK — ${frags.length} fragment(s), ${added} new string(s)`);
