import { translate, translatorFor, normalizeLocale, hasMessage } from "@/i18n/translate";
import { getServerLocale, getServerT, withLocale } from "@/i18n/server";

describe("translate (sync)", () => {
  it("defaults to Hebrew — existing callers are unchanged", () => {
    expect(translate(undefined, "common.actions.save")).toBe("שמור");
    expect(translate("fr-FR", "common.actions.save")).toBe("שמור");
  });
  it("reads English for en-US / en", () => {
    expect(translate("en-US", "common.actions.save")).toBe("Save");
    expect(translate("en", "common.actions.save")).toBe("Save");
    expect(normalizeLocale("en_GB")).toBe("en-US");
  });
  it("namespaced translator + interpolation", () => {
    const he = translatorFor("he-IL", "paywall.limitReachedModal");
    const en = translatorFor("en-US", "paywall.limitReachedModal");
    expect(he("upgradeCta", { currencySymbol: "₪", price: 99 })).toBe("שדרג לבייסיק — ₪99/חודש");
    expect(en("upgradeCta", { currencySymbol: "$", price: 29 })).toBe("Upgrade to Basic — $29/month");
  });
  it("a missing key never throws", () => {
    expect(() => translate("en-US", "no.such.key")).not.toThrow();
    expect(translate("en-US", "no.such.key")).toBe("no.such.key");
  });
  it("hasMessage checks he.json", () => {
    expect(hasMessage("common.actions.save")).toBe(true);
    expect(hasMessage("common.actions.nope")).toBe(false);
  });
});

describe("server locale", () => {
  it("outside a request → he-IL", async () => {
    await expect(getServerLocale()).resolves.toBe("he-IL");
    const t = await getServerT("common.actions");
    expect(t("save")).toBe("שמור");
  });
  it("withLocale scopes the locale (incl. across awaits)", async () => {
    await withLocale("en-US", async () => {
      await Promise.resolve();
      expect(await getServerLocale()).toBe("en-US");
      expect((await getServerT("common.actions"))("save")).toBe("Save");
    });
    await expect(getServerLocale()).resolves.toBe("he-IL");
  });
});
