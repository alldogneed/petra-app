/**
 * Tests for safeNextPath — the post-login `next` validator (MCP OAuth consent flow).
 * Pure module.
 */
import { safeNextPath } from "../safe-redirect";

describe("safeNextPath", () => {
  it("accepts the OAuth authorize path with a query string", () => {
    const next =
      "/oauth/authorize?response_type=code&client_id=abc&redirect_uri=https%3A%2F%2Fclaude.ai%2Fapi%2Fmcp%2Fauth_callback&state=xyz&code_challenge=AAA&code_challenge_method=S256";
    expect(safeNextPath(next)).toBe(next);
  });

  it("accepts the bare authorize path", () => {
    expect(safeNextPath("/oauth/authorize")).toBe("/oauth/authorize");
  });

  it("accepts a loopback redirect_uri inside the query", () => {
    const next = "/oauth/authorize?redirect_uri=http%3A%2F%2F127.0.0.1%3A33418%2Fcallback";
    expect(safeNextPath(next)).toBe(next);
  });

  it("rejects empty / non-string input", () => {
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath("")).toBeNull();
    expect(safeNextPath("   ")).toBeNull();
  });

  it("rejects other in-app paths (tight allowlist)", () => {
    expect(safeNextPath("/dashboard")).toBeNull();
    expect(safeNextPath("/settings?tab=ai")).toBeNull();
    expect(safeNextPath("/oauth/authorizeX")).toBeNull();
    expect(safeNextPath("/oauth/authorize/../../dashboard")).toBeNull();
    expect(safeNextPath("/oauth/authorize#frag")).toBeNull();
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(safeNextPath("https://evil.com/oauth/authorize")).toBeNull();
    expect(safeNextPath("//evil.com/oauth/authorize")).toBeNull();
    expect(safeNextPath("javascript:alert(1)")).toBeNull();
    expect(safeNextPath("oauth/authorize")).toBeNull();
  });

  it("rejects backslashes", () => {
    expect(safeNextPath("/\\evil.com")).toBeNull();
    expect(safeNextPath("/oauth/authorize\\..\\x")).toBeNull();
  });

  it("rejects control characters", () => {
    expect(safeNextPath("/oauth/authorize\n")).toBe("/oauth/authorize"); // trimmed
    expect(safeNextPath("/oauth/\nauthorize")).toBeNull();
    expect(safeNextPath("/oauth/authorize?\u0000")).toBeNull();
    expect(safeNextPath("/\t/evil.com")).toBeNull();
  });

  it("rejects encoded tricks after one decode", () => {
    expect(safeNextPath("/%2F%2Fevil.com")).toBeNull();
    expect(safeNextPath("/%5Cevil.com")).toBeNull();
    expect(safeNextPath("/oauth%2Fauthorize")).toBeNull();
    expect(safeNextPath("/oauth/authorize?x=%0d%0aSet-Cookie")).toBeNull();
    expect(safeNextPath("/oauth/authorize?x=%E0%A4%A")).toBeNull(); // malformed
  });

  it("rejects overly long input", () => {
    expect(safeNextPath("/oauth/authorize?x=" + "a".repeat(5000))).toBeNull();
  });
});
