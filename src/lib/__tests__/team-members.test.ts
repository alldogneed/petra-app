jest.mock("@/lib/prisma", () => ({ __esModule: true, default: {} }));
import { matchMember } from "@/services/team-members";

const team = [
  { id: "u1", name: "עמית לוי" },
  { id: "u2", name: "דור אבנת" },
  { id: "u3", name: "עמית כהן" },
];

describe("matchMember", () => {
  it("by id, exact name, unique first name", () => {
    expect(matchMember(team, "u2")?.id).toBe("u2");
    expect(matchMember(team, " דור  אבנת ")?.id).toBe("u2");
    expect(matchMember(team, "דור")?.id).toBe("u2");
  });
  it("ambiguous or unknown → null", () => {
    expect(matchMember(team, "עמית")).toBeNull();
    expect(matchMember(team, "יוסי")).toBeNull();
    expect(matchMember(team, "")).toBeNull();
  });
});
