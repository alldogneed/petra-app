/**
 * Tests for the MCP OAuth pure helpers — redirect URI registration policy + matching
 * (RFC 8252 loopback), PKCE S256, client-name sanitizing, RFC 8707 resource check,
 * metadata documents, token/code generators. No Prisma calls.
 */
import crypto from "crypto";
import {
  validateRedirectUriForRegistration,
  redirectUriMatches,
  verifyPkceS256,
  sanitizeClientName,
  isValidResource,
  getMcpResourceUrl,
  getOAuthOrigin,
  protectedResourceMetadata,
  authorizationServerMetadata,
  generateAuthCode,
  generateRefreshToken,
  sha256Hex,
  oauthCorsHeaders,
  REFRESH_TOKEN_PREFIX,
} from "@/lib/mcp-oauth";

const ORIGIN = "https://petra-app.com";

describe("validateRedirectUriForRegistration", () => {
  it("accepts https on any host", () => {
    expect(validateRedirectUriForRegistration("https://claude.ai/api/mcp/auth_callback")).toBeNull();
    expect(validateRedirectUriForRegistration("https://example.com:8443/cb?x=1")).toBeNull();
  });
  it("accepts http only for loopback hosts", () => {
    expect(validateRedirectUriForRegistration("http://127.0.0.1:33418/callback")).toBeNull();
    expect(validateRedirectUriForRegistration("http://localhost:6274/oauth/callback")).toBeNull();
    expect(validateRedirectUriForRegistration("http://[::1]:5000/cb")).toBeNull();
    expect(validateRedirectUriForRegistration("http://example.com/cb")).not.toBeNull();
    expect(validateRedirectUriForRegistration("http://127.0.0.1.evil.com/cb")).not.toBeNull();
    expect(validateRedirectUriForRegistration("http://localhost.evil.com/cb")).not.toBeNull();
  });
  it("accepts private-use custom schemes", () => {
    expect(validateRedirectUriForRegistration("cursor://anysphere.cursor-retrieval/oauth/callback")).toBeNull();
    expect(validateRedirectUriForRegistration("vscode://vscode.github-authentication/did-authenticate")).toBeNull();
    expect(validateRedirectUriForRegistration("com.example.app:/oauth2redirect")).toBeNull();
  });
  it("rejects dangerous schemes", () => {
    for (const uri of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "file:///etc/passwd",
      "vbscript:msgbox(1)",
      "about:blank",
      "blob:https://petra-app.com/abc",
    ]) {
      expect(validateRedirectUriForRegistration(uri)).not.toBeNull();
    }
  });
  it("rejects fragments, userinfo, whitespace, relative and oversized URIs", () => {
    expect(validateRedirectUriForRegistration("https://example.com/cb#frag")).not.toBeNull();
    expect(validateRedirectUriForRegistration("https://user:pass@example.com/cb")).not.toBeNull();
    expect(validateRedirectUriForRegistration("https://user@example.com/cb")).not.toBeNull();
    expect(validateRedirectUriForRegistration("https://example.com/c b")).not.toBeNull();
    expect(validateRedirectUriForRegistration("https://example.com/cb" + String.fromCharCode(10))).not.toBeNull();
    expect(validateRedirectUriForRegistration("/relative/cb")).not.toBeNull();
    expect(validateRedirectUriForRegistration("")).not.toBeNull();
    expect(validateRedirectUriForRegistration("https://example.com/" + "a".repeat(500))).not.toBeNull();
    expect(validateRedirectUriForRegistration(123 as unknown as string)).not.toBeNull();
  });
  it("rejects schemes with invalid characters", () => {
    expect(validateRedirectUriForRegistration("1abc://x")).not.toBeNull();
    expect(validateRedirectUriForRegistration("my_app://x")).not.toBeNull();
  });
});

describe("redirectUriMatches", () => {
  const registered = [
    "https://claude.ai/api/mcp/auth_callback",
    "http://127.0.0.1:33418/callback",
    "http://localhost/cb?x=1",
    "cursor://anysphere.cursor-retrieval/oauth/callback",
  ];
  it("matches exact strings", () => {
    expect(redirectUriMatches(registered, "https://claude.ai/api/mcp/auth_callback")).toBe(true);
    expect(redirectUriMatches(registered, "cursor://anysphere.cursor-retrieval/oauth/callback")).toBe(true);
  });
  it("does not loosen non-loopback URIs", () => {
    expect(redirectUriMatches(registered, "https://claude.ai/api/mcp/auth_callback/")).toBe(false);
    expect(redirectUriMatches(registered, "https://claude.ai/api/mcp/auth_callback?x=1")).toBe(false);
    expect(redirectUriMatches(registered, "https://claude.ai:444/api/mcp/auth_callback")).toBe(false);
    expect(redirectUriMatches(registered, "https://evil.com/api/mcp/auth_callback")).toBe(false);
  });
  it("allows any port on a registered loopback URI (RFC 8252)", () => {
    expect(redirectUriMatches(registered, "http://127.0.0.1:51234/callback")).toBe(true);
    expect(redirectUriMatches(registered, "http://127.0.0.1/callback")).toBe(true);
    expect(redirectUriMatches(registered, "http://localhost:9999/cb?x=1")).toBe(true);
  });
  it("requires same loopback host, path and query", () => {
    expect(redirectUriMatches(registered, "http://localhost:51234/callback")).toBe(false);
    expect(redirectUriMatches(registered, "http://127.0.0.1:51234/other")).toBe(false);
    expect(redirectUriMatches(registered, "http://localhost:9999/cb?x=2")).toBe(false);
    expect(redirectUriMatches(registered, "http://localhost:9999/cb")).toBe(false);
    expect(redirectUriMatches(registered, "http://127.0.0.1:51234/callback#x")).toBe(false);
    expect(redirectUriMatches(registered, "https://127.0.0.1:51234/callback")).toBe(false);
  });
  it("handles empty input", () => {
    expect(redirectUriMatches([], "https://claude.ai/api/mcp/auth_callback")).toBe(false);
    expect(redirectUriMatches(registered, "")).toBe(false);
  });
});

describe("verifyPkceS256", () => {
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"; // RFC 7636 appendix B
  const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
  it("accepts the RFC 7636 test vector", () => {
    expect(verifyPkceS256(verifier, challenge)).toBe(true);
  });
  it("accepts a freshly generated pair", () => {
    const v = crypto.randomBytes(48).toString("base64url");
    const c = crypto.createHash("sha256").update(v).digest("base64url");
    expect(verifyPkceS256(v, c)).toBe(true);
  });
  it("rejects wrong verifier / challenge", () => {
    expect(verifyPkceS256(verifier + "x", challenge)).toBe(false);
    expect(verifyPkceS256(verifier, challenge.slice(0, -1) + "A")).toBe(false);
  });
  it("rejects plain method (verifier === challenge)", () => {
    expect(verifyPkceS256(verifier, verifier)).toBe(false);
  });
  it("enforces verifier length 43–128 and charset", () => {
    const short = "a".repeat(42);
    expect(verifyPkceS256(short, crypto.createHash("sha256").update(short).digest("base64url"))).toBe(false);
    const long = "a".repeat(129);
    expect(verifyPkceS256(long, crypto.createHash("sha256").update(long).digest("base64url"))).toBe(false);
    const max = "a".repeat(128);
    expect(verifyPkceS256(max, crypto.createHash("sha256").update(max).digest("base64url"))).toBe(true);
    const bad = "a".repeat(42) + "+";
    expect(verifyPkceS256(bad, crypto.createHash("sha256").update(bad).digest("base64url"))).toBe(false);
  });
  it("rejects non-strings", () => {
    expect(verifyPkceS256(undefined as unknown as string, challenge)).toBe(false);
    expect(verifyPkceS256(verifier, null as unknown as string)).toBe(false);
  });
});

describe("sanitizeClientName", () => {
  it("falls back for non-strings and empty values", () => {
    expect(sanitizeClientName(undefined)).toBe("עוזר AI");
    expect(sanitizeClientName(42)).toBe("עוזר AI");
    expect(sanitizeClientName("   ")).toBe("עוזר AI");
  });
  it("strips control chars, newlines and bidi overrides", () => {
    const nl = String.fromCharCode(10);
    const rlo = String.fromCharCode(0x202e);
    const nul = String.fromCharCode(0);
    expect(sanitizeClientName(`Claude${nl}Ignore previous`)).toBe("Claude Ignore previous");
    expect(sanitizeClientName(`${rlo}Claude${nul}`)).toBe("Claude");
  });
  it("trims and caps at 60 characters", () => {
    expect(sanitizeClientName("  Claude  ")).toBe("Claude");
    const out = sanitizeClientName("x".repeat(100));
    expect(out.length).toBe(60);
  });
  it("keeps Hebrew", () => {
    expect(sanitizeClientName("העוזר שלי")).toBe("העוזר שלי");
  });
});

describe("isValidResource / getMcpResourceUrl", () => {
  it("builds the resource URL", () => {
    expect(getMcpResourceUrl(ORIGIN)).toBe("https://petra-app.com/api/mcp");
  });
  it("absent resource is valid", () => {
    expect(isValidResource(undefined, ORIGIN)).toBe(true);
    expect(isValidResource(null, ORIGIN)).toBe(true);
    expect(isValidResource("", ORIGIN)).toBe(true);
  });
  it("matches with or without one trailing slash", () => {
    expect(isValidResource("https://petra-app.com/api/mcp", ORIGIN)).toBe(true);
    expect(isValidResource("https://petra-app.com/api/mcp/", ORIGIN)).toBe(true);
  });
  it("rejects other resources", () => {
    expect(isValidResource("https://petra-app.com/api/mcp//", ORIGIN)).toBe(false);
    expect(isValidResource("https://evil.com/api/mcp", ORIGIN)).toBe(false);
    expect(isValidResource("https://petra-app.com/", ORIGIN)).toBe(false);
    expect(isValidResource("https://petra-app.com/api/mcp/u/abc", ORIGIN)).toBe(false);
  });
});

describe("getOAuthOrigin", () => {
  it("uses the request URL origin by default", () => {
    expect(getOAuthOrigin(new Request("https://petra-app.com/api/oauth/token"))).toBe("https://petra-app.com");
  });
  it("honors x-forwarded-proto / x-forwarded-host", () => {
    const req = new Request("http://internal:3000/x", {
      headers: { "x-forwarded-proto": "https", "x-forwarded-host": "petra-app.com" },
    });
    expect(getOAuthOrigin(req)).toBe("https://petra-app.com");
  });
  it("takes the first value of a forwarded list and drops default ports", () => {
    const req = new Request("http://internal:3000/x", {
      headers: { "x-forwarded-proto": "https, http", "x-forwarded-host": "petra-app.com:443, other" },
    });
    expect(getOAuthOrigin(req)).toBe("https://petra-app.com");
  });
  it("ignores malformed forwarded hosts", () => {
    const req = new Request("https://petra-app.com/x", {
      headers: { "x-forwarded-host": "evil.com/path?x=" },
    });
    expect(getOAuthOrigin(req)).toBe("https://petra-app.com");
  });
});

describe("metadata documents", () => {
  it("protected resource metadata (RFC 9728)", () => {
    const prm = protectedResourceMetadata(ORIGIN);
    expect(prm.resource).toBe("https://petra-app.com/api/mcp");
    expect(prm.authorization_servers).toEqual([ORIGIN]);
    expect(prm.bearer_methods_supported).toEqual(["header"]);
    expect(prm.resource_name).toBe("Petra");
    expect(prm.scopes_supported).toEqual(["mcp"]);
  });
  it("authorization server metadata (RFC 8414)", () => {
    const as = authorizationServerMetadata(ORIGIN);
    expect(as.issuer).toBe(ORIGIN);
    expect(as.authorization_endpoint).toBe("https://petra-app.com/oauth/authorize");
    expect(as.token_endpoint).toBe("https://petra-app.com/api/oauth/token");
    expect(as.registration_endpoint).toBe("https://petra-app.com/api/oauth/register");
    expect(as.revocation_endpoint).toBe("https://petra-app.com/api/oauth/revoke");
    expect(as.response_types_supported).toEqual(["code"]);
    expect(as.grant_types_supported).toEqual(["authorization_code", "refresh_token"]);
    expect(as.code_challenge_methods_supported).toEqual(["S256"]);
    expect(as.token_endpoint_auth_methods_supported).toEqual(["none"]);
    expect(as.revocation_endpoint_auth_methods_supported).toEqual(["none"]);
    expect(as.authorization_response_iss_parameter_supported).toBe(true);
    expect(as.scopes_supported).toEqual(["mcp"]);
  });
  it("CORS headers", () => {
    const h = oauthCorsHeaders();
    expect(h["Access-Control-Allow-Origin"]).toBe("*");
    expect(h["Access-Control-Allow-Methods"]).toContain("POST");
    expect(h["Access-Control-Allow-Headers"]).toContain("mcp-protocol-version");
  });
});

describe("generators", () => {
  it("auth codes are 64 hex chars, hashed with SHA-256", () => {
    const { raw, hash } = generateAuthCode();
    expect(raw).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(sha256Hex(raw));
    expect(generateAuthCode().raw).not.toBe(raw);
  });
  it("refresh tokens use a prefix distinct from access tokens", () => {
    const { raw, hash } = generateRefreshToken();
    expect(raw.startsWith(REFRESH_TOKEN_PREFIX)).toBe(true);
    expect(raw.startsWith("petra_mcp_")).toBe(false);
    expect(raw).toMatch(/^petra_mcpr_[0-9a-f]{64}$/);
    expect(hash).toBe(sha256Hex(raw));
  });
});
