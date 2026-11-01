/**
 * Signing up as a "generic" business before the onboarding choice exists:
 * `/register?type=other` (a link to share with non-pet businesses). Plain `/register`
 * is unchanged (dogs). The choice is kept in sessionStorage so it survives
 * "המשך עם Google" (same tab), and the email path also sends it to the register API.
 * Client-safe; every storage access is wrapped — private windows may throw.
 */
import type { Vertical } from "./index";

export const SIGNUP_VERTICAL_KEY = "petra_signup_vertical";

/** `?type=other` → "generic"; anything else → null (dogs = today's flow). */
export function signupVerticalFromParam(type: string | null | undefined): Vertical | null {
  return type === "other" ? "generic" : null;
}

export function rememberSignupVertical(vertical: Vertical | null): void {
  if (vertical !== "generic") return;
  try {
    sessionStorage.setItem(SIGNUP_VERTICAL_KEY, vertical);
  } catch {
    /* storage blocked — the email path still sends it to the API */
  }
}

export function readSignupVertical(): Vertical | null {
  try {
    return sessionStorage.getItem(SIGNUP_VERTICAL_KEY) === "generic" ? "generic" : null;
  } catch {
    return null;
  }
}

export function clearSignupVertical(): void {
  try {
    sessionStorage.removeItem(SIGNUP_VERTICAL_KEY);
  } catch {
    /* ignore */
  }
}
