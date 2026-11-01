// Node test env: a minimal sessionStorage (the helper only uses get/set/remove).
const store = new Map<string, string>();
(globalThis as unknown as { sessionStorage: Pick<Storage, "getItem" | "setItem" | "removeItem" | "clear"> }).sessionStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => void store.set(k, String(v)),
  removeItem: (k) => void store.delete(k),
  clear: () => store.clear(),
};
import {
  clearSignupVertical,
  readSignupVertical,
  rememberSignupVertical,
  signupVerticalFromParam,
} from "@/lib/verticals/signup";

describe("signup vertical (/register?type=other)", () => {
  beforeEach(() => sessionStorage.clear());
  it("only ?type=other means generic; plain /register stays dogs", () => {
    expect(signupVerticalFromParam("other")).toBe("generic");
    expect(signupVerticalFromParam(null)).toBeNull();
    expect(signupVerticalFromParam("dogs")).toBeNull();
    expect(signupVerticalFromParam("generic")).toBeNull();
  });
  it("is remembered across the Google round trip and cleared after the business step", () => {
    expect(readSignupVertical()).toBeNull();
    rememberSignupVertical(null);
    expect(readSignupVertical()).toBeNull();
    rememberSignupVertical("generic");
    expect(readSignupVertical()).toBe("generic");
    clearSignupVertical();
    expect(readSignupVertical()).toBeNull();
  });
});
