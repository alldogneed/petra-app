/**
 * The WhatsApp free-text guard lives in scripts/audit-whatsapp-free-text.mjs (it also runs
 * in `build` / `vercel-build`). This test runs it so `jest` catches a regression locally.
 */
import { execFileSync } from "child_process";
import path from "path";

describe("WhatsApp free-text guard", () => {
  it("passes on the current tree", () => {
    const script = path.join(__dirname, "..", "..", "..", "scripts", "audit-whatsapp-free-text.mjs");
    expect(() => execFileSync(process.execPath, [script], { stdio: "pipe" })).not.toThrow();
  });
});
