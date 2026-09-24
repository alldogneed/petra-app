/**
 * The recurring order must be built on a real Cardcom token (`Token`, returned
 * by BillAndCreateToken). `ExtShvaParams.CardToken` is Shva's reference —
 * orders built on it fail every charge with "8000 Token Not Found".
 */

import { extractCardToken } from "@/lib/cardcom-recurring";

describe("extractCardToken", () => {
  it("returns the Cardcom Token from a BillAndCreateToken response", () => {
    expect(extractCardToken({ Token: "tok-1", "ExtShvaParams.CardToken": "shva-1" })).toBe("tok-1");
  });
  it("ignores the Shva CardToken of a BillOnly charge", () => {
    expect(extractCardToken({ "ExtShvaParams.CardToken": "4ce834fa-8a65-450f-a203-e7d7dacb82e2" })).toBeNull();
  });
  it("empty Token → null", () => {
    expect(extractCardToken({ Token: "" })).toBeNull();
  });
});
