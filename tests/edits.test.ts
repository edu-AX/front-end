import { beforeEach, describe, expect, it } from "vitest";
import { allBudgets, applyEventFacts, EMPTY_EXT_STATE, getExt, setEdit, setExtOverlay, won, type ExtState } from "@/lib/ext";
import { getEvent } from "@/lib/data";

const apply = (prev: ExtState, patch: Partial<ExtState>): ExtState => ({ ...prev, ...patch });

describe("담당자가 고친 값 (시연용 편집)", () => {
  beforeEach(() => setExtOverlay(EMPTY_EXT_STATE));

  it("예산을 고치면 원본 위에 덮여 보이고, 원래 값으로 되돌릴 수 있다", () => {
    const b0 = allBudgets().find((b) => b.id === "B-03")!;
    const sources = b0.sources.map((s) => (s.type === "수익자부담" ? { ...s, spent: 9_999_000 } : s));
    const s1 = apply(EMPTY_EXT_STATE, setEdit(EMPTY_EXT_STATE, "budgets", "B-03", { sources, items: b0.items }, "2027-03-11"));
    setExtOverlay(s1);
    expect(allBudgets().find((b) => b.id === "B-03")!.sources.find((s) => s.type === "수익자부담")!.spent).toBe(9_999_000);
    expect(s1.edits.meta["budgets:B-03"]).toBe("2027-03-11");

    const s2 = apply(s1, setEdit(s1, "budgets", "B-03", null, "2027-03-12"));
    setExtOverlay(s2);
    expect(allBudgets().find((b) => b.id === "B-03")!.sources.find((s) => s.type === "수익자부담")!.spent).toBe(b0.sources.find((s) => s.type === "수익자부담")!.spent);
    expect(s2.edits.meta["budgets:B-03"]).toBeUndefined();
  });

  it("참가 인원·교육청 기준을 고치면 행사 카드에 덮여 보인다 (기준이 없는 교내 행사는 인원만)", () => {
    const trip = getEvent("E-07")!;
    const s = apply(EMPTY_EXT_STATE, setEdit(EMPTY_EXT_STATE, "facts", "E-07", { participants: 200, consentRate: "75% 이상" }, "2027-03-11"));
    const ev = applyEventFacts(trip, s.edits);
    expect(ev.participants).toBe(200);
    expect(ev.officeRules?.consentRate).toBe("75% 이상");
    expect(ev.officeRules?.safetyStaff).toBe(trip.officeRules?.safetyStaff);
    expect(trip.participants).not.toBe(200); // 원본은 그대로

    const inSchool = getEvent("E-03")!;
    const s2 = apply(EMPTY_EXT_STATE, setEdit(EMPTY_EXT_STATE, "facts", "E-03", { participants: 10, consentRate: "x" }, "2027-03-11"));
    expect(applyEventFacts(inSchool, s2.edits).officeRules).toBeUndefined();
  });

  it("담당 이력은 고친 목록 전체로 바뀐다", () => {
    const owner = { year: 2027, role: "주담당", name: null, consentToShow: false, contact: null, notes: { good: "a", problem: "b", nextYear: "c" } };
    const s = apply(EMPTY_EXT_STATE, setEdit(EMPTY_EXT_STATE, "owners", "E-07", [owner], "2027-03-11"));
    setExtOverlay(s);
    expect(getExt("E-07").ownerHistory).toEqual([owner]);
  });

  it("금액 표시는 음수도 읽기 쉽게", () => {
    expect(won(-6_000_000)).toBe("-600만원");
    expect(won(-500)).toBe("-500원");
    expect(won(5_400_000)).toBe("540만원");
  });
});
