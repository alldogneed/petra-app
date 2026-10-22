import { verifyCronAuth } from "@/lib/cron-auth";
import type { NextRequest } from "next/server";

const req = (headers: Record<string, string>) =>
  ({ headers: { get: (k: string) => headers[k.toLowerCase()] ?? null } }) as unknown as NextRequest;

describe("verifyCronAuth", () => {
  const env = process.env;
  afterEach(() => { process.env = env; });

  it("accepts CRON_SECRET and CRON_SECRET_DB, rejects others", () => {
    process.env = { ...env, CRON_SECRET: "main-secret", CRON_SECRET_DB: "db-secret" };
    expect(verifyCronAuth(req({ authorization: "Bearer main-secret" }))).toBe(true);
    expect(verifyCronAuth(req({ authorization: "Bearer db-secret" }))).toBe(true);
    expect(verifyCronAuth(req({ "x-cron-secret": "db-secret" }))).toBe(true);
    expect(verifyCronAuth(req({ authorization: "Bearer nope" }))).toBe(false);
    expect(verifyCronAuth(req({}))).toBe(false);
  });
  it("works with only CRON_SECRET, and fails closed with none", () => {
    process.env = { ...env, CRON_SECRET: "main-secret", CRON_SECRET_DB: "" };
    expect(verifyCronAuth(req({ authorization: "Bearer main-secret" }))).toBe(true);
    expect(verifyCronAuth(req({ authorization: "Bearer " }))).toBe(false);
    process.env = { ...env, CRON_SECRET: "", CRON_SECRET_DB: "" };
    expect(verifyCronAuth(req({ authorization: "Bearer " }))).toBe(false);
  });
});
