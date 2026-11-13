// 작업 지시서 3 — 업로드 검토 화면(6탭) 폼 모델
import { describe, expect, it } from "vitest";
import { DEMO_DRAFT } from "@/lib/upload/draft";
import { fieldStatus, fromDraft, hasConfirmedCaution, reviewCounts, reviewFields, toAmount, toDraft } from "@/lib/uploadForm";

describe("uploadForm", () => {
  const f = fromDraft(DEMO_DRAFT, "2027-10-15");

  it("왕복: 고치지 않으면 초안 그대로 (금액·후보·추가 단계·진로)", () => {
    const d = toDraft(f);
    expect(d.title).toBe(DEMO_DRAFT.title);
    expect(d.budget?.total).toBe(4800000);
    expect(d.budget?.sources.map((s) => s.amount)).toEqual([2100000, 2700000]);
    expect(d.candidates).toHaveLength(3);
    expect(d.customSteps).toEqual([expect.objectContaining({ id: "custom-doc-1", offsetDays: -30 })]);
    expect(d.career?.tracks).toEqual(["공학", "사회", "교육"]);
    expect(d.ownerNote).not.toBeNull();
  });

  it("상태: 처음엔 확인함 0, 저장 조건은 주의점 확인", () => {
    const c0 = reviewCounts(f, new Set());
    expect(c0.ok).toBe(0);
    expect(c0.ai).toBeGreaterThan(10);
    expect(hasConfirmedCaution(f, new Set())).toBe(false);
    expect(hasConfirmedCaution(f, new Set([`caution:${f.cautions[0].uid}`]))).toBe(true);
    // 다른 항목만 확인해서는 저장 불가
    expect(hasConfirmedCaution(f, new Set(["title", "handoverNote"]))).toBe(false);
  });

  it("빈 탭은 '비어 있음'", () => {
    const empty = fromDraft({ ...DEMO_DRAFT, budget: null, venues: [], candidates: [], skipped: [], career: null, ownerNote: null }, "2027-10-15");
    const byTab = (t: string) => reviewFields(empty).filter((x) => x.tab === t);
    for (const t of ["budget", "venue", "record", "owner", "career"]) expect(byTab(t).every((x) => x.empty)).toBe(true);
    const d = toDraft(empty);
    expect(d).toMatchObject({ budget: null, venues: [], candidates: [], skipped: [], career: null, ownerNote: null });
    expect(fieldStatus(true, true)).toBe("empty");
  });

  it("담당자가 고친 글도 저장 전에 가린다", () => {
    const g = { ...f, cautions: [{ uid: "x", text: "문의는 010-1234-5678 로" }] };
    expect(toDraft(g).cautions[0]).not.toContain("010-1234-5678");
  });

  it("금액 입력: 쉼표·'원' 허용", () => {
    expect(toAmount("1,800,000원")).toBe(1800000);
    expect(toAmount("")).toBeNull();
    expect(toAmount("abc")).toBeNull();
  });
});
