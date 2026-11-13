// 작업 지시서 3 — 업로드 초안 → 탭 데이터 변환, 정적 데이터와 합치기
import { describe, expect, it } from "vitest";
import { allBudgets, EMPTY_EXT_STATE, eventBudget, findVenue, getExt, getRecord, type ExtState } from "@/lib/ext";
import type { DraftExtras } from "@/lib/types";
import { DEMO_DRAFT, draftExtras } from "@/lib/upload/draft";
import { applyUploadExtras, draftBudgetToBudget, draftVenueToVenue, extrasToEventExt, NOT_IN_DOC } from "@/lib/uploadExtras";

const EMPTY_EXTRAS: DraftExtras = { budget: null, venues: [], candidates: [], skipped: [], career: null, ownerNote: null };
const withAdded = (p: Partial<ExtState>): ExtState => ({ ...EMPTY_EXT_STATE, ...p });

describe("변환: DraftBudget → Budget", () => {
  it("금액·재원·1인당·메모 (작년 집행이라 편성=집행)", () => {
    const b = draftBudgetToBudget(DEMO_DRAFT.budget!, { id: "B-U1", eventId: "U1", year: 2026 });
    expect(b).toMatchObject({ id: "B-U1", eventId: "U1", year: 2026, settlement: null, fromUpload: true });
    expect(b.sources).toEqual([
      { type: "학교회계", planned: 2100000, spent: 2100000, transferable: true },
      { type: "수익자부담", planned: 2700000, spent: 2700000, transferable: false, perStudent: 15000 },
    ]);
    expect(b.items.map((i) => i.planned)).toEqual([2100000, 1800000, 900000]);
    expect(b.lastYear).toEqual({ total: 4800000, perStudent: 15000, memo: expect.stringContaining("버스") });
  });

  it("빈 값·부분 값: 금액 모르면 표시만 '문서에 없음', 총액은 재원 합", () => {
    const b = draftBudgetToBudget({ total: null, perStudent: null, sources: [{ type: "학교회계", amount: 500000 }, { type: "교육청 지원금", amount: null }], items: [{ name: "교통", amount: null }], memo: "" }, { id: "B", eventId: "X", year: 2026 });
    expect(b.sources[1]).toMatchObject({ planned: 0, amountUnknown: true });
    expect(b.items[0]).toMatchObject({ planned: 0, amountUnknown: true });
    expect(b.lastYear).toEqual({ total: 500000, perStudent: null, memo: NOT_IN_DOC });
  });
});

describe("변환: DraftVenue → Venue", () => {
  it("문서에 없는 필드는 '문서에 없음', 평점 없으면 0", () => {
    const v = draftVenueToVenue({ name: "(가상) 강당", type: "", memo: "", rating: null }, { id: "V-X-1", eventId: "X", year: 2026 });
    expect(v).toMatchObject({ name: "(가상) 강당", type: NOT_IN_DOC, address: NOT_IN_DOC, capacity: 0, safetyChecks: [], fromUpload: true });
    expect(v.history).toEqual([{ year: 2026, eventId: "X", rating: 0, memo: NOT_IN_DOC }]);
  });
});

describe("변환: EventExt (진로·담당 이력)", () => {
  it("담당 이력은 이름 없이 'YYYY 담당 교사'", () => {
    const x = extrasToEventExt(draftExtras(DEMO_DRAFT), { year: 2026, budgetId: "B-U1", venueIds: ["V-U1-1"] });
    expect(x).toMatchObject({ careerTracks: ["공학", "사회", "교육"], creativeArea: "진로활동", budgetId: "B-U1", venueIds: ["V-U1-1"], fromUpload: true });
    expect(x.ownerHistory).toEqual([
      expect.objectContaining({ year: 2026, role: "2026 담당 교사", name: null, consentToShow: false, contact: null }),
    ]);
  });

  it("빈 초안 → 빈 탭 (지어내지 않음)", () => {
    const x = extrasToEventExt(EMPTY_EXTRAS, { year: 2026, budgetId: null, venueIds: [] });
    expect(x).toMatchObject({ careerTracks: [], linkedSubjects: [], creativeArea: "", target: "", ownerHistory: [] });
  });
});

describe("applyUploadExtras + 정적 데이터와 합치기", () => {
  const added = withAdded(applyUploadExtras(EMPTY_EXT_STATE, "U1", draftExtras(DEMO_DRAFT), 2026));

  it("getExt·eventBudget·findVenue·getRecord 가 추가 데이터를 본다", () => {
    expect(getExt("U1", added).budgetId).toBe("B-U1");
    expect(eventBudget("U1", added)?.lastYear.total).toBe(4800000);
    expect(findVenue("V-U1-1", added)?.name).toContain("한빛컨벤션센터");
    expect(getRecord("U1", added)?.candidates).toHaveLength(3);
    expect(allBudgets(added).length).toBe(allBudgets(EMPTY_EXT_STATE).length + 1);
  });

  it("정적 데이터 카드는 그대로 (E-07 예산·장소·고민 기록)", () => {
    expect(getExt("E-07", added).budgetId).toBe("B-03");
    expect(eventBudget("E-07", added)?.id).toBe("B-03");
    expect(findVenue("V-02", added)).toBeDefined();
    expect(getRecord("E-07", added)?.candidates.some((c) => !c.chosen && c.reason.includes("대피로"))).toBe(true);
    expect(getRecord("E-03", added)).toBeNull();
  });

  it("같은 행사로 다시 저장하면 그 행사 것만 바뀐다", () => {
    const again = withAdded({ ...added, ...applyUploadExtras(added, "U1", { ...EMPTY_EXTRAS, venues: [{ name: "새 장소", type: "", memo: "", rating: 5 }] }, 2026) });
    expect(again.addedBudgets).toHaveLength(0);
    expect(again.addedVenues.map((v) => v.name)).toEqual(["새 장소"]);
    expect(again.addedRecords.U1).toBeUndefined();
  });
});
