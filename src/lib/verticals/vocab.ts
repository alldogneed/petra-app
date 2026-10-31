/**
 * vocab — the ONE dictionary for words that differ between verticals.
 *
 *   vocab("nav.training")                               → "ניהול תהליכי אילוף"  (dogs = today's text)
 *   vocab("nav.training", { vertical: "generic" })      → "ניהול תוכניות"
 *   vocab("program.of", { vertical, params: { name } }) → "{name}" interpolated
 *
 * Values live in messages/{locale}.json under the `vocab` namespace as
 * `vocab.<key>.<vertical>` — the same files the US plan's next-intl setup will read
 * (docs/us-expansion/PHASE-0-foundation.md), so there is no second dictionary.
 * Adding English = adding messages/en.json with the same keys (+ an entry in MESSAGES);
 * no other code change.
 *
 * Rules (enforced by src/lib/__tests__/vocab.test.ts):
 *   - every key has both "dogs" and "generic";
 *   - the "dogs" value is the text the code showed before verticals, character for character;
 *   - no "generic" value contains a dog/pet word.
 *
 * Pure + client-safe (the JSON is bundled).
 */
import he from "../../../messages/he.json";
import { DEFAULT_VERTICAL, normalizeVertical, type Vertical } from "./index";

export type VocabLocale = "he";
export const DEFAULT_VOCAB_LOCALE: VocabLocale = "he";

type VocabEntry = Record<Vertical, string>;
type VocabTable = Record<string, VocabEntry>;

const MESSAGES: Record<VocabLocale, { vocab: VocabTable }> = {
  he: he as { vocab: VocabTable },
};

export type VocabKey = keyof typeof he.vocab;

export interface VocabOptions {
  locale?: string | null;
  vertical?: string | null;
  params?: Record<string, string | number | null | undefined>;
}

function tableFor(locale: string | null | undefined): VocabTable {
  const lang = (locale ?? DEFAULT_VOCAB_LOCALE).toLowerCase().split(/[-_]/)[0];
  return (MESSAGES[lang as VocabLocale] ?? MESSAGES[DEFAULT_VOCAB_LOCALE]).vocab;
}

function interpolate(text: string, params: VocabOptions["params"]): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined || value === null ? whole : String(value);
  });
}

export function vocab(key: VocabKey, opts: VocabOptions = {}): string {
  const table = tableFor(opts.locale);
  const entry = table[key] ?? MESSAGES[DEFAULT_VOCAB_LOCALE].vocab[key];
  if (!entry) return key; // unreachable for a typed key
  const vertical = normalizeVertical(opts.vertical);
  const text = entry[vertical] ?? entry[DEFAULT_VERTICAL];
  return interpolate(text, opts.params);
}

/** Bind a vertical (and locale) once: `const v = vocabFor(vertical); v("nav.training")`. */
export function vocabFor(vertical: string | null | undefined, locale?: string | null) {
  return (key: VocabKey, params?: VocabOptions["params"]) => vocab(key, { vertical, locale, params });
}

/** All keys of the default locale — for tests and the scan tooling. */
export function vocabKeys(): VocabKey[] {
  return Object.keys(MESSAGES[DEFAULT_VOCAB_LOCALE].vocab) as VocabKey[];
}

export function vocabTable(locale: VocabLocale = DEFAULT_VOCAB_LOCALE): Readonly<VocabTable> {
  return MESSAGES[locale].vocab;
}
