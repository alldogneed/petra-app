import { ownBlobPath, uploadFileProblem, uploadContentType, directUploadErrorText } from "../blob-direct-upload"

const DOG = "service-dogs/abc/"
const OK = "https://vd0izwltrfibbypf.public.blob.vercel-storage.com/service-dogs/abc/doc-x1Y2.pdf"

describe("ownBlobPath", () => {
  it("accepts our store under the dog's folder", () => {
    expect(ownBlobPath(OK, DOG)).toBe("service-dogs/abc/doc-x1Y2.pdf")
  })
  it("rejects other hosts, other folders, traversal, bad types, http", () => {
    expect(ownBlobPath("https://evil.com/service-dogs/abc/a.pdf", DOG)).toBeNull()
    expect(ownBlobPath(OK.replace("/abc/", "/other/"), DOG)).toBeNull()
    expect(ownBlobPath(OK.replace("doc-x1Y2.pdf", "../x/a.pdf"), DOG)).toBeNull()
    expect(ownBlobPath(OK.replace(".pdf", ".exe"), DOG)).toBeNull()
    expect(ownBlobPath(OK.replace("https:", "http:"), DOG)).toBeNull()
    expect(ownBlobPath(123, DOG)).toBeNull()
  })
})

describe("uploadFileProblem", () => {
  it("7MB PDF is fine now (was blocked at 4.5MB)", () => {
    expect(uploadFileProblem({ name: "a.PDF", size: 7 * 1024 * 1024 })).toBeNull()
  })
  it("over 10MB / wrong type", () => {
    expect(uploadFileProblem({ name: "a.pdf", size: 11 * 1024 * 1024 })).toContain("10MB")
    expect(uploadFileProblem({ name: "a.exe", size: 10 })).toBe("סוג קובץ לא מורשה")
  })
})

describe("uploadContentType / directUploadErrorText", () => {
  it("falls back to the extension when the browser type is empty", () => {
    expect(uploadContentType({ name: "x.pdf", type: "" })).toBe("application/pdf")
    expect(uploadContentType({ name: "x.png", type: "image/png" })).toBe("image/png")
  })
  it("Blob library errors become Hebrew", () => {
    expect(directUploadErrorText(new Error("Vercel Blob: Failed to retrieve the client token"))).toContain("ההעלאה נכשלה")
    expect(directUploadErrorText(new Error("כלב לא נמצא"))).toBe("כלב לא נמצא")
  })
})
