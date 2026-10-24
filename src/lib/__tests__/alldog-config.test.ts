import { allDogAnthropicKey, isCallSummariesEnabled, isWaBotEnabled } from "@/lib/alldog/config";

const OLD_ENV = process.env;
const BASE = {
  ALLDOG_BUSINESS_ID: "biz",
  ALLDOG_CALL_SUMMARIES_ENABLED: "true",
  ALLDOG_WA_BOT_ENABLED: "true",
  ELEVENLABS_API_KEY: "e",
  ALLDOG_WA_TOKEN: "t",
  ALLDOG_WA_PHONE_NUMBER_ID: "p",
};

afterEach(() => {
  process.env = OLD_ENV;
});

describe("allDogAnthropicKey", () => {
  it("prefers ALLDOG_ANTHROPIC_API_KEY", () => {
    process.env = { ...OLD_ENV, ALLDOG_ANTHROPIC_API_KEY: "alldog", ANTHROPIC_API_KEY: "petra" };
    expect(allDogAnthropicKey()).toBe("alldog");
  });
  it("falls back to ANTHROPIC_API_KEY (also when the AllDog key is blank)", () => {
    process.env = { ...OLD_ENV, ALLDOG_ANTHROPIC_API_KEY: " \n", ANTHROPIC_API_KEY: "petra" };
    expect(allDogAnthropicKey()).toBe("petra");
  });
  it("is undefined when neither is set", () => {
    process.env = { ...OLD_ENV };
    delete process.env.ALLDOG_ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    expect(allDogAnthropicKey()).toBeUndefined();
  });
});

describe("flags accept either key", () => {
  it.each([
    [{ ALLDOG_ANTHROPIC_API_KEY: "a" }, true],
    [{ ANTHROPIC_API_KEY: "a" }, true],
    [{}, false],
  ])("%j → %s", (keys, expected) => {
    process.env = { ...OLD_ENV, ...BASE, ...keys };
    if (!("ALLDOG_ANTHROPIC_API_KEY" in keys)) delete process.env.ALLDOG_ANTHROPIC_API_KEY;
    if (!("ANTHROPIC_API_KEY" in keys)) delete process.env.ANTHROPIC_API_KEY;
    expect(isWaBotEnabled()).toBe(expected);
    expect(isCallSummariesEnabled()).toBe(expected);
  });
});
