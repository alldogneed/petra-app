/**
 * Jest setup: when I18N_FRAGMENTS=a.json,b.json is set, deep-merge those not-yet-merged
 * i18n fragments ({ he: {...}, en: {...} }) into messages/he.json + en.json for this test
 * run only (in memory). Lets a migration agent run the Hebrew tests of its files before the
 * lead merges the fragment. No effect when the variable is unset.
 */
const fs = require("fs");
const path = require("path");
const list = (process.env.I18N_FRAGMENTS || "").split(",").filter(Boolean);
if (list.length) {
  const he = require(path.join(__dirname, "messages/he.json"));
  const en = require(path.join(__dirname, "messages/en.json"));
  const merge = (base, over) => {
    for (const [k, v] of Object.entries(over || {})) {
      if (v && typeof v === "object" && base[k] && typeof base[k] === "object") merge(base[k], v);
      else base[k] = v;
    }
  };
  for (const f of list) {
    const frag = JSON.parse(fs.readFileSync(f, "utf8"));
    merge(he, frag.he);
    merge(en, frag.en);
  }
}
