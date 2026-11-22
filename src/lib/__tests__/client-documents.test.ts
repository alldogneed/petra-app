import {
  parseDocList,
  normalizeDocs,
  sortDocsNewestFirst,
  isPublicBlobUrl,
  contractEffectiveStatus,
  contractSummary,
  sortContractsNewestFirst,
  israelYear,
  docCategoryHe,
  type ContractRow,
} from "../client-documents";

const BLOB = "https://abc123.public.blob.vercel-storage.com/customers/c1/f.pdf";

describe("parseDocList", () => {
  it("returns [] for garbage", () => {
    expect(parseDocList(null)).toEqual([]);
    expect(parseDocList(undefined)).toEqual([]);
    expect(parseDocList("")).toEqual([]);
    expect(parseDocList("not json")).toEqual([]);
    expect(parseDocList("{\"a\":1}")).toEqual([]);
    expect(parseDocList(42)).toEqual([]);
    expect(parseDocList({ id: "x" })).toEqual([]);
  });
  it("drops non-object entries", () => {
    expect(parseDocList(JSON.stringify([1, "x", null, [1], { id: "a" }]))).toEqual([{ id: "a" }]);
  });
  it("accepts arrays and a Json column holding a JSON string", () => {
    expect(parseDocList([{ id: "a" }])).toEqual([{ id: "a" }]);
    expect(parseDocList(JSON.stringify(JSON.stringify([{ id: "b" }])))).toEqual([{ id: "b" }]);
  });
});

describe("normalizeDocs", () => {
  it("normalises the customer document shape", () => {
    const raw = JSON.stringify([
      { id: "d1", name: "חוזה פנסיון", originalName: "c.pdf", mimeType: "application/pdf", size: 10, url: BLOB, category: "contract", createdAt: "2026-11-01T10:00:00.000Z" },
    ]);
    expect(normalizeDocs(raw, "customer")).toEqual([
      { id: "d1", name: "חוזה פנסיון", category: "contract", uploadedAt: "2026-11-01T10:00:00.000Z", source: "customer", mimeType: "application/pdf", size: 10, url: BLOB },
    ]);
  });
  it("pet attachments: type, pet name, skips the profile photo", () => {
    const raw = JSON.stringify([
      { id: "p1", name: "פנקס חיסונים", type: "vaccination", createdAt: "2026-10-01T00:00:00Z" },
      { id: "p2", name: "avatar.jpg", type: "profile_photo", createdAt: "2026-10-02T00:00:00Z" },
    ]);
    const out = normalizeDocs(raw, "pet", { id: "pet1", name: "רקס" });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "p1", category: "vaccination", petId: "pet1", petName: "רקס", source: "pet" });
  });
  it("service-dog shape: docType + uploadedAt + fileSize, lower-cased", () => {
    const out = normalizeDocs([{ id: "s1", name: "ביטוח", docType: "INSURANCE", uploadedAt: "2026-09-01T00:00:00Z", fileSize: 99 }], "service_dog");
    expect(out[0]).toMatchObject({ category: "insurance", uploadedAt: "2026-09-01T00:00:00.000Z", size: 99 });
  });
  it("never copies file contents or unknown keys; non-blob urls dropped; bad dates null", () => {
    const out = normalizeDocs([{ name: "x", data: "data:application/pdf;base64,AAAA", url: "data:abc", token: "s3cret", createdAt: "garbage" }], "customer");
    expect(out[0]).not.toHaveProperty("data");
    expect(out[0]).not.toHaveProperty("token");
    expect(out[0].url).toBeUndefined();
    expect(out[0].uploadedAt).toBeNull();
    expect(out[0].id).toBeNull();
  });
  it("falls back to a name", () => {
    expect(normalizeDocs([{ originalName: "a.pdf" }], "customer")[0].name).toBe("a.pdf");
    expect(normalizeDocs([{}], "customer")[0].name).toBe("מסמך ללא שם");
  });
});

describe("isPublicBlobUrl", () => {
  it("only public Vercel Blob https URLs", () => {
    expect(isPublicBlobUrl(BLOB)).toBe(true);
    expect(isPublicBlobUrl("http://abc.public.blob.vercel-storage.com/x")).toBe(false);
    expect(isPublicBlobUrl("https://evil.com/abc.public.blob.vercel-storage.com/x")).toBe(false);
    expect(isPublicBlobUrl("https://petra-app.com/sign/abc")).toBe(false);
    expect(isPublicBlobUrl(5)).toBe(false);
  });
});

describe("sortDocsNewestFirst", () => {
  it("newest first, undated last", () => {
    const docs = [
      { id: "a", uploadedAt: "2026-01-01T00:00:00Z" },
      { id: "b", uploadedAt: null },
      { id: "c", uploadedAt: "2026-06-01T00:00:00Z" },
    ];
    expect(sortDocsNewestFirst(docs).map((d) => d.id)).toEqual(["c", "a", "b"]);
  });
});

const NOW = new Date("2026-11-21T10:00:00Z");
function contract(p: Partial<ContractRow>): ContractRow {
  return {
    id: "k",
    status: "PENDING",
    templateName: "חוזה פנסיון",
    petName: null,
    createdAt: "2026-01-01T00:00:00Z",
    sentAt: null,
    openedAt: null,
    signedAt: null,
    expiresAt: "2026-12-31T00:00:00Z",
    hasSignedFile: false,
    ...p,
  };
}

describe("contractEffectiveStatus", () => {
  it("maps stored status + expiry", () => {
    expect(contractEffectiveStatus(contract({ status: "SIGNED", signedAt: "2026-02-01T00:00:00Z" }), NOW)).toBe("SIGNED");
    expect(contractEffectiveStatus(contract({ status: "EXPIRED" }), NOW)).toBe("EXPIRED");
    expect(contractEffectiveStatus(contract({ expiresAt: "2026-11-01T00:00:00Z" }), NOW)).toBe("EXPIRED");
    expect(contractEffectiveStatus(contract({ openedAt: "2026-11-20T00:00:00Z" }), NOW)).toBe("OPENED");
    expect(contractEffectiveStatus(contract({}), NOW)).toBe("PENDING");
  });
});

describe("contractSummary", () => {
  it("no contracts", () => {
    expect(contractSummary([], NOW)).toEqual({
      total: 0, signedCount: 0, awaitingCount: 0, latestSigned: null, signedThisYear: false, signedByYear: [],
    });
  });
  it("latest signed, per-year counts, signed this year", () => {
    const s = contractSummary(
      [
        contract({ id: "old", status: "SIGNED", signedAt: "2025-03-01T00:00:00Z", templateName: "ישן" }),
        contract({ id: "new", status: "SIGNED", signedAt: "2026-11-12T08:00:00Z", templateName: "חוזה 2026", petName: "רקס" }),
        contract({ id: "mid", status: "SIGNED", signedAt: "2026-02-01T00:00:00Z" }),
        contract({ id: "pend" }),
        contract({ id: "exp", status: "EXPIRED" }),
      ],
      NOW
    );
    expect(s.latestSigned).toEqual({ id: "new", templateName: "חוזה 2026", petName: "רקס", signedAt: "2026-11-12T08:00:00.000Z" });
    expect(s.signedCount).toBe(3);
    expect(s.awaitingCount).toBe(1);
    expect(s.signedThisYear).toBe(true);
    expect(s.signedByYear).toEqual([{ year: 2026, count: 2 }, { year: 2025, count: 1 }]);
  });
  it("signed only last year → not this year", () => {
    const s = contractSummary([contract({ status: "SIGNED", signedAt: "2025-06-01T00:00:00Z" })], NOW);
    expect(s.signedThisYear).toBe(false);
    expect(s.latestSigned?.signedAt).toBe("2025-06-01T00:00:00.000Z");
  });
  it("uses the Israel calendar year (31/12 23:30 UTC = 1/1 in Israel)", () => {
    expect(israelYear("2025-12-31T23:30:00Z")).toBe(2026);
    const s = contractSummary([contract({ status: "SIGNED", signedAt: "2025-12-31T23:30:00Z" })], new Date("2026-01-05T00:00:00Z"));
    expect(s.signedThisYear).toBe(true);
  });
});

describe("sortContractsNewestFirst / labels", () => {
  it("orders by signed, else sent, else created", () => {
    const rows = [
      contract({ id: "a", createdAt: "2026-01-01T00:00:00Z" }),
      contract({ id: "b", sentAt: "2026-05-01T00:00:00Z" }),
      contract({ id: "c", signedAt: "2026-03-01T00:00:00Z", status: "SIGNED" }),
    ];
    expect(sortContractsNewestFirst(rows).map((r) => r.id)).toEqual(["b", "c", "a"]);
  });
  it("Hebrew category labels", () => {
    expect(docCategoryHe("contract")).toBe("חוזה");
    expect(docCategoryHe(null)).toBe("אחר");
    expect(docCategoryHe("weird")).toBe("weird");
  });
});
