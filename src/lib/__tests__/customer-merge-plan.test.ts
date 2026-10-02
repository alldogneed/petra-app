import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MERGE_RELATIONS, MERGE_IGNORED_SCALARS, mergeTags, mergeNotes, mergeDocuments,
  buildCustomerMergeUpdate, emptyMergeCounts, totalMergeCount, mergeConfirmToken, phoneTail,
  type MergeableCustomer,
} from "../customer-merge-plan";

// ─── Schema parsing (test-time) ──────────────────────────────────────────────

interface ParsedField { name: string; type: string; line: string }
interface ParsedModel { name: string; fields: ParsedField[]; blockAttrs: string[] }

function parseSchema(src: string): ParsedModel[] {
  const models: ParsedModel[] = [];
  const re = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const fields: ParsedField[] = [];
    const blockAttrs: string[] = [];
    for (const rawLine of m[2].split("\n")) {
      const line = rawLine.replace(/\/\/.*$/, "").trim();
      if (!line) continue;
      if (line.startsWith("@@")) { blockAttrs.push(line); continue; }
      const fm = /^(\w+)\s+([\w]+(?:\[\])?\??)/.exec(line);
      if (fm) fields.push({ name: fm[1], type: fm[2], line });
    }
    models.push({ name: m[1], fields, blockAttrs });
  }
  return models;
}

const schema = readFileSync(join(__dirname, "..", "..", "..", "prisma", "schema.prisma"), "utf8");
const models = parseSchema(schema);
const byName = new Map(models.map((x) => [x.name, x]));
const covered = new Set(MERGE_RELATIONS.map((r) => `${r.model}.${r.field}`));

describe("customer merge plan covers the schema", () => {
  it("parses a sane number of models", () => {
    expect(models.length).toBeGreaterThan(30);
    expect(byName.has("Customer")).toBe(true);
  });

  it("every FK relation to Customer is in MERGE_RELATIONS", () => {
    const missing: string[] = [];
    for (const model of models) {
      if (model.name === "Customer") continue;
      for (const f of model.fields) {
        if (f.type.replace(/[?\[\]]/g, "") !== "Customer") continue;
        if (f.type.endsWith("[]")) continue; // back-relation list (e.g. Business.customers) — FK lives on Customer
        const rel = /@relation\([^)]*fields:\s*\[([^\]]+)\]/.exec(f.line);
        expect(rel).not.toBeNull();
        for (const col of rel![1].split(",").map((s) => s.trim())) {
          if (!covered.has(`${model.name}.${col}`)) missing.push(`${model.name}.${col}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("every scalar column named like a customer id is covered or explicitly ignored", () => {
    const missing: string[] = [];
    for (const model of models) {
      for (const f of model.fields) {
        if (!/^(customerId|\w+CustomerId)$/.test(f.name)) continue;
        const key = `${model.name}.${f.name}`;
        if (!covered.has(key) && !MERGE_IGNORED_SCALARS.includes(key)) missing.push(key);
      }
    }
    expect(missing).toEqual([]);
  });

  it("every model with a polymorphic relatedEntityType that can be CUSTOMER is covered", () => {
    const missing: string[] = [];
    for (const model of models) {
      const typeField = model.fields.find((f) => f.name === "relatedEntityType");
      const idField = model.fields.find((f) => f.name === "relatedEntityId");
      if (!typeField || !idField) continue;
      // The schema comments list the allowed types; CUSTOMER-capable models must be covered.
      const rawBlock = new RegExp(`^model\\s+${model.name}\\s*\\{([\\s\\S]*?)^\\}`, "m").exec(schema)![1];
      const typeLine = rawBlock.split("\n").find((l) => /^\s*relatedEntityType\s/.test(l)) ?? "";
      const comment = typeLine.includes("//") ? typeLine.slice(typeLine.indexOf("//")) : "";
      const mayBeCustomer = /CUSTOMER/i.test(comment) || /entity type for generated tasks/.test(comment);
      if (mayBeCustomer && !covered.has(`${model.name}.relatedEntityId`)) missing.push(model.name);
    }
    expect(missing).toEqual([]);
  });

  it("every plan row points at an existing model + field", () => {
    for (const r of MERGE_RELATIONS) {
      const model = byName.get(r.model);
      expect(model).toBeDefined();
      expect(model!.fields.some((f) => f.name === r.field)).toBe(true);
      if (r.kind === "entity_ref") {
        expect(model!.fields.some((f) => f.name === "relatedEntityType")).toBe(true);
      }
    }
  });

  it("scopedByBusinessId matches a non-nullable businessId column", () => {
    for (const r of MERGE_RELATIONS) {
      const bid = byName.get(r.model)!.fields.find((f) => f.name === "businessId");
      const nonNullable = !!bid && bid.type === "String";
      expect({ model: r.model, scoped: r.scopedByBusinessId }).toEqual({ model: r.model, scoped: nonNullable });
    }
  });

  it("no unique constraint includes the customer column unless a conflict strategy is declared", () => {
    for (const r of MERGE_RELATIONS) {
      const model = byName.get(r.model)!;
      const fieldUnique = model.fields.find((f) => f.name === r.field)?.line.includes("@unique") ?? false;
      const blockUnique = model.blockAttrs.some((a) => {
        const u = /^@@(?:unique|id)\(\s*\[([^\]]+)\]/.exec(a);
        return !!u && u[1].split(",").map((s) => s.trim()).includes(r.field);
      });
      if (fieldUnique || blockUnique) {
        expect({ model: r.model, strategy: (r as { onUniqueConflict?: string }).onUniqueConflict ?? null })
          .toEqual({ model: r.model, strategy: "skip_duplicate" });
      }
    }
  });

  it("keys are unique", () => {
    const keys = MERGE_RELATIONS.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

// ─── Field merge ─────────────────────────────────────────────────────────────

describe("mergeTags", () => {
  it("keeps target order, appends new source tags, dedupes case-insensitively", () => {
    expect(mergeTags('["VIP","קבוע"]', '["vip","עסקי","קבוע"]')).toBe('["VIP","קבוע","עסקי"]');
  });
  it("handles empty / invalid JSON", () => {
    expect(mergeTags("[]", "not json")).toBe("[]");
    expect(mergeTags(null, '["A"]')).toBe('["A"]');
    expect(mergeTags('["a", 5, "", " b "]', "[]")).toBe('["a","b"]');
  });
  it("stays under the 1000-char column cap", () => {
    const many = JSON.stringify(Array.from({ length: 200 }, (_, i) => `tag-number-${i}`));
    expect(mergeTags(many, "[]").length).toBeLessThanOrEqual(1000);
  });
});

describe("mergeNotes", () => {
  it("returns target when source empty", () => {
    expect(mergeNotes("T", null, "X")).toBe("T");
    expect(mergeNotes(null, "  ", "X")).toBe(null);
  });
  it("fills empty target", () => {
    expect(mergeNotes(null, "S", "X")).toBe("S");
    expect(mergeNotes("", "S", "X")).toBe("S");
  });
  it("concats with header when both present", () => {
    expect(mergeNotes("T", "S", "דנה")).toBe("T\n---\nממוזג מדנה: S");
  });
  it("is idempotent", () => {
    const once = mergeNotes("T", "S", "דנה");
    expect(mergeNotes(once, "S", "דנה")).toBe(once);
  });
  it("caps at 5000", () => {
    expect(mergeNotes("a".repeat(4990), "b".repeat(100), "X")!.length).toBe(5000);
  });
});

describe("mergeDocuments", () => {
  it("concats arrays and dedupes by id (idempotent)", () => {
    const t = JSON.stringify([{ id: "1", url: "u1" }]);
    const s = JSON.stringify([{ id: "2", url: "u2" }, { id: "1", url: "u1" }]);
    const merged = mergeDocuments(t, s);
    expect(JSON.parse(merged).map((d: { id: string }) => d.id)).toEqual(["1", "2"]);
    expect(mergeDocuments(merged, s)).toBe(merged);
  });
  it("tolerates invalid JSON", () => {
    expect(mergeDocuments("oops", '[{"id":"x"}]')).toBe('[{"id":"x"}]');
  });
});

describe("buildCustomerMergeUpdate", () => {
  const base: MergeableCustomer = {
    name: "T", phone: "050", email: null, address: null, idNumber: null,
    secondContactName: null, secondContactPhone: null, notes: null, tags: "[]", documents: "[]",
  };
  it("fills empty target fields only", () => {
    const u = buildCustomerMergeUpdate(
      { ...base, email: "t@x.com" },
      { ...base, name: "S", email: "s@x.com", address: "רחוב 1", idNumber: "123", secondContactName: "אבא", secondContactPhone: "052" },
    );
    expect(u).toEqual({ address: "רחוב 1", idNumber: "123", secondContactName: "אבא", secondContactPhone: "052" });
  });
  it("returns {} when nothing changes", () => {
    expect(buildCustomerMergeUpdate({ ...base, tags: '["A"]' }, { ...base, tags: '["a"]' })).toEqual({});
  });
  it("merges tags, notes, documents", () => {
    const u = buildCustomerMergeUpdate(
      { ...base, notes: "T", tags: '["A"]', documents: '[{"id":"1"}]' },
      { ...base, name: "S", notes: "N", tags: '["B"]', documents: '[{"id":"2"}]' },
    );
    expect(u.notes).toBe("T\n---\nממוזג מS: N");
    expect(u.tags).toBe('["A","B"]');
    expect(JSON.parse(u.documents!)).toHaveLength(2);
  });
});

describe("helpers", () => {
  it("emptyMergeCounts has every key at 0", () => {
    const c = emptyMergeCounts();
    expect(Object.keys(c).length).toBe(MERGE_RELATIONS.length);
    expect(totalMergeCount(c)).toBe(0);
  });
  it("confirm token", () => {
    expect(mergeConfirmToken("abc")).toBe("MERGE_abc");
  });
  it("phoneTail", () => {
    expect(phoneTail("050-123-4567")).toBe("501234567");
    expect(phoneTail("+972501234567")).toBe("501234567");
    expect(phoneTail("12")).toBeNull();
  });
});
