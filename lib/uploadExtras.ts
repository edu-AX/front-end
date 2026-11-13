// 업로드 초안의 나머지 탭 데이터(draftExtras) → 화면 전용 데이터(Budget·Venue·EventExt·고민 기록) 변환.
// 문서에 없는 값은 지어내지 않고 "문서에 없음"으로 둔다 (화면에서 fromUpload 로 구분해 표시).
import type { Budget, EventExt, ExtState, HandoverRecord, Venue } from "./ext";
import type { DraftBudget, DraftExtras, DraftVenue } from "./types";

export const NOT_IN_DOC = "문서에 없음";

export function draftBudgetToBudget(b: DraftBudget, o: { id: string; eventId: string; year: number }): Budget {
  const sources = b.sources.map((s) => ({
    type: s.type,
    planned: s.amount ?? 0,
    spent: s.amount ?? 0, // 결과보고서 = 작년 실제 집행
    transferable: s.type.includes("학교회계"),
    ...(s.type.includes("수익자") && b.perStudent ? { perStudent: b.perStudent } : {}),
    ...(s.amount === null ? { amountUnknown: true } : {}),
  }));
  const items = b.items.map((i) => ({ name: i.name, planned: i.amount ?? 0, ...(i.amount === null ? { amountUnknown: true } : {}) }));
  const sum = b.sources.reduce((n, s) => n + (s.amount ?? 0), 0);
  return {
    id: o.id,
    eventId: o.eventId,
    year: o.year,
    sources,
    items,
    settlement: null, // 정산 기한은 교육청 기준이라 문서에서 만들지 않는다
    lastYear: { total: b.total ?? sum, perStudent: b.perStudent, memo: b.memo.trim() || NOT_IN_DOC },
    fromUpload: true,
  };
}

export function draftVenueToVenue(v: DraftVenue, o: { id: string; eventId: string; year: number }): Venue {
  return {
    id: o.id,
    name: v.name,
    type: v.type.trim() || NOT_IN_DOC,
    address: NOT_IN_DOC,
    travelMinutes: 0,
    busParking: NOT_IN_DOC,
    capacity: 0,
    lastInspectionYear: 0,
    safetyChecks: [],
    emergency: { hospital: NOT_IN_DOC, fire: NOT_IN_DOC, police: NOT_IN_DOC },
    vendor: { name: NOT_IN_DOC, contract: NOT_IN_DOC },
    history: [{ year: o.year, eventId: o.eventId, rating: v.rating ?? 0, memo: v.memo.trim() || NOT_IN_DOC }],
    fromUpload: true,
  };
}

export function extrasToEventExt(x: DraftExtras, o: { year: number; budgetId: string | null; venueIds: string[] }): EventExt {
  const n = x.ownerNote;
  return {
    careerTracks: x.career?.tracks ?? [],
    linkedSubjects: x.career?.subjects ?? [],
    creativeArea: x.career?.creativeArea ?? "",
    target: x.career?.target ?? "",
    budgetId: o.budgetId,
    venueIds: o.venueIds,
    // 담당 이력은 이름 없이 "○○○○ 담당 교사" 표기만 (개인정보)
    ownerHistory: n
      ? [{
          year: o.year,
          role: `${o.year} 담당 교사`,
          name: null,
          consentToShow: false,
          contact: null,
          notes: { good: n.good.trim() || NOT_IN_DOC, problem: n.problem.trim() || NOT_IN_DOC, nextYear: n.nextYear.trim() || NOT_IN_DOC },
        }]
      : [],
    fromUpload: true,
  };
}

/**
 * 업로드 저장 시 ext 상태에 넣을 값. 같은 행사로 다시 저장하면 그 행사 것만 바꾼다.
 * 사용: updateExt((p) => applyUploadExtras(p, eventId, draftExtras(draft), year))
 */
export function applyUploadExtras(p: ExtState, eventId: string, x: DraftExtras, year: number): Partial<ExtState> {
  const budget = x.budget ? draftBudgetToBudget(x.budget, { id: `B-${eventId}`, eventId, year }) : null;
  const venues = x.venues.map((v, i) => draftVenueToVenue(v, { id: `V-${eventId}-${i + 1}`, eventId, year }));
  const record: HandoverRecord | null = x.candidates.length || x.skipped.length ? { candidates: x.candidates, skipped: x.skipped } : null;
  const ext = extrasToEventExt(x, { year, budgetId: budget?.id ?? null, venueIds: venues.map((v) => v.id) });

  const addedRecords = { ...p.addedRecords };
  if (record) addedRecords[eventId] = record;
  else delete addedRecords[eventId];

  return {
    addedExt: { ...p.addedExt, [eventId]: ext },
    addedBudgets: [...p.addedBudgets.filter((b) => b.eventId !== eventId), ...(budget ? [budget] : [])],
    addedVenues: [...p.addedVenues.filter((v) => !v.id.startsWith(`V-${eventId}-`)), ...venues],
    addedRecords,
  };
}
