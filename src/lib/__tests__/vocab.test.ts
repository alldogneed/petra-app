import he from "../../../messages/he.json";
import { vocab, vocabFor, vocabKeys, vocabTable } from "@/lib/verticals/vocab";

const DOG_WORDS = /כלב|חיות מחמד|חיית מחמד|חיית המחמד|גור |גורים|🐕|🐶|🐾|פנסיון|אילוף|מאלף/;

describe("messages/he.json vocab", () => {
  const table = vocabTable();
  it("has at least one key", () => {
    expect(vocabKeys().length).toBeGreaterThan(0);
  });
  it.each(Object.keys(he.vocab))("%s has both dogs and generic, non-empty", (key) => {
    const entry = table[key];
    expect(Object.keys(entry).sort()).toEqual(["dogs", "generic"]);
    expect(entry.dogs.trim()).not.toBe("");
    expect(entry.generic.trim()).not.toBe("");
  });
  it.each(Object.keys(he.vocab))("%s — the generic value has no dog/pet word", (key) => {
    expect(table[key].generic).not.toMatch(DOG_WORDS);
  });
  it.each(Object.keys(he.vocab))("%s — generic uses only {params} the dogs text has", (key) => {
    // generic may drop a param (e.g. the pet name) but never needs one callers don't pass.
    const params = (s: string) => new Set(s.match(/\{\w+\}/g) ?? []);
    const dogs = params(table[key].dogs);
    for (const p of Array.from(params(table[key].generic))) expect(dogs.has(p)).toBe(true);
  });
});

describe("vocab()", () => {
  it("defaults to dogs", () => {
    expect(vocab("nav.training")).toBe("ניהול תהליכי אילוף");
    expect(vocab("nav.training", { vertical: "nope" })).toBe("ניהול תהליכי אילוף");
  });
  it("returns the generic value", () => {
    expect(vocab("nav.training", { vertical: "generic" })).toBe("ניהול תוכניות");
  });
  it("falls back to he for an unknown locale", () => {
    expect(vocab("nav.training", { vertical: "generic", locale: "en-US" })).toBe("ניהול תוכניות");
  });
  it("vocabFor binds the vertical", () => {
    const v = vocabFor("generic");
    expect(v("nav.training")).toBe("ניהול תוכניות");
  });
});
