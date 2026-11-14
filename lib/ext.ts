// 확장 기능(예산·장소·담당 이력·진로별 보기). 백엔드 약속(lib/types.ts)은 건드리지 않고,
// 행사 id(E-xx)로만 연결합니다. 백엔드 팀과 합의되면 types.ts 로 옮길 수 있어요.
import budgetsJson from "@/data/budgets.json";
import venuesJson from "@/data/venues.json";
import extEventsJson from "@/data/ext-events.json";
import extraEventsJson from "@/data/extra-events.json";
import careerJson from "@/data/careerTracks.json";
import checklistJson from "@/data/safetyChecklists.json";
import recordsJson from "@/data/handover-records.json";
import { eventsWithAdded } from "./data";
import type { DesignProfile } from "./noticeDesign";
import { addDays } from "./dates";
import { effectiveEventDate } from "./schedule";
import type { ClientState, DateString, DraftCandidate, EventCard } from "./types";

export type Owner = {
  year: number; role: string; name: string | null; consentToShow: boolean; contact: string | null;
  notes: { good: string; problem: string; nextYear: string };
};
export type EventExt = {
  careerTracks: string[]; linkedSubjects: string[]; creativeArea: string; target: string;
  budgetId: string | null; venueIds: string[]; ownerHistory: Owner[];
  /** 결과보고서 업로드로 만든 데이터 (빈 칸은 "문서에 없음"으로 표시) */
  fromUpload?: boolean;
};
export type BudgetSource = { type: string; planned: number; spent: number; transferable: boolean; perStudent?: number; amountUnknown?: boolean };
export type Budget = {
  id: string; eventId: string; year: number; sources: BudgetSource[]; items: { name: string; planned: number; amountUnknown?: boolean }[];
  settlement: { dueDaysAfterEvent: number; disclosureDaysAfterSettlement: number; officeSource: string } | null;
  lastYear: { total: number; perStudent: number | null; memo: string };
  fromUpload?: boolean;
};
export type Venue = {
  id: string; name: string; type: string; address: string; travelMinutes: number; busParking: string; capacity: number; lastInspectionYear: number;
  safetyChecks: { item: string; result: string; checkedAt: string; evidence: string }[];
  emergency: { hospital: string; fire: string; police: string }; vendor: { name: string; contract: string };
  history: { year: number; eventId: string; rating: number; memo: string }[];
  fromUpload?: boolean;
};
/** 전임자의 고민 기록: 후보 비교·탈락 이유, 해보니 불필요했던 과정 */
export type HandoverRecord = { candidates: DraftCandidate[]; skipped: string[] };

/**
 * 담당자가 화면에서 고친 값 (시연용: 브라우저에 저장). 원본 JSON 은 그대로 두고 위에 덮어서 보여준다.
 * 서버 저장으로 바꿀 때는 이 모양 그대로 저장소에 올리면 된다.
 */
export type VenueEdit = Pick<Venue, "lastInspectionYear" | "travelMinutes" | "capacity" | "busParking" | "safetyChecks" | "emergency" | "history">;
export type Edits = {
  budgets: Record<string, Pick<Budget, "sources" | "items">>; // budgetId
  venues: Record<string, VenueEdit>; // venueId
  owners: Record<string, Owner[]>; // eventId → 담당 이력 전체(고친 결과)
  facts: Record<string, { participants?: number; consentRate?: string; safetyStaff?: string }>; // eventId
  /** "budget:B-03" → 마지막으로 고친 날짜 */
  meta: Record<string, string>;
};
export const EMPTY_EDITS: Edits = { budgets: {}, venues: {}, owners: {}, facts: {}, meta: {} };

/** localStorage "handover:ext:v1" — 백엔드 ClientState 와 따로 보관하는 화면 전용 상태 */
export type ExtState = {
  extraDone: Record<string, boolean>; // "E-07:settle" → 완료 여부
  charPos: { x: number; y: number } | null;
  hidden: boolean;
  // ---- 결과보고서 업로드로 채운 탭 데이터 (정적 JSON 과 합쳐서 보여줌) ----
  addedExt: Record<string, EventExt>; // eventId → 진로·과목·담당 이력
  addedBudgets: Budget[];
  addedVenues: Venue[];
  addedRecords: Record<string, HandoverRecord>; // eventId → 고민 기록
  /** 담당자가 직접 고친 값 (예산·장소·담당 이력·참가 인원·교육청 기준) */
  edits: Edits;
  /** 가정통신문 양식 레퍼런스 (개인정보를 가린 글자만 보관. 원본 파일은 저장하지 않는다) */
  noticeRefs: NoticeRef[];
};
export type NoticeRef = { id: string; name: string; text: string; summary: string[]; addedAt: string; design?: DesignProfile; designSummary?: string[] };
export const EMPTY_EXT_STATE: ExtState = {
  extraDone: {}, charPos: null, hidden: false,
  addedExt: {}, addedBudgets: [], addedVenues: [], addedRecords: {},
  edits: EMPTY_EDITS,
  noticeRefs: [],
};
export type ExtOverlay = Pick<ExtState, "addedExt" | "addedBudgets" | "addedVenues" | "addedRecords"> & Partial<Pick<ExtState, "edits">>;

const EMPTY_EXT: EventExt = { careerTracks: [], linkedSubjects: [], creativeArea: "", target: "", budgetId: null, venueIds: [], ownerHistory: [] };

export const budgets = budgetsJson as unknown as Budget[];
export const venues = venuesJson as unknown as Venue[];
export const extEvents = extEventsJson as unknown as Record<string, EventExt>;
export const extraEvents = extraEventsJson as unknown as EventCard[];
export const tracks = careerJson.tracks as string[];
export const studentCounts = careerJson.studentCounts as unknown as Record<string, Record<string, number>>;
export const safetyChecklists = checklistJson as unknown as Record<string, string[]>;
/** 정적 고민 기록 (시연용: E-07 수학여행) */
export const staticRecords = recordsJson as unknown as Record<string, HandoverRecord>;

/**
 * 업로드로 추가한 탭 데이터. AppProvider 가 ext 상태가 바뀔 때마다 setExtOverlay 로 넣어 주고,
 * getExt·eventBudget·findVenue·getRecord 가 정적 JSON 과 합쳐서 본다 (호출하는 쪽은 그대로).
 */
let overlay: ExtOverlay = EMPTY_EXT_STATE;
export function setExtOverlay(o: ExtOverlay) {
  overlay = o;
}

export const getExt = (eventId: string, o: ExtOverlay = overlay): EventExt => {
  const base = o.addedExt?.[eventId] ?? extEvents[eventId] ?? EMPTY_EXT;
  const owners = o.edits?.owners?.[eventId];
  return owners ? { ...base, ownerHistory: owners } : base;
};
export const allBudgets = (o: ExtOverlay = overlay): Budget[] =>
  [...budgets, ...(o.addedBudgets ?? [])].map((b) => (o.edits?.budgets?.[b.id] ? { ...b, ...o.edits.budgets[b.id] } : b));
export const allVenues = (o: ExtOverlay = overlay): Venue[] =>
  [...venues, ...(o.addedVenues ?? [])].map((v) => (o.edits?.venues?.[v.id] ? { ...v, ...o.edits.venues[v.id] } : v));

/** 고친 참가 인원·교육청 기준을 행사 카드에 덮어쓴다 */
export function applyEventFacts(ev: EventCard, edits?: Edits): EventCard {
  const f = edits?.facts?.[ev.id];
  if (!f) return ev;
  return {
    ...ev,
    ...(f.participants !== undefined ? { participants: f.participants } : {}),
    ...(ev.officeRules ? { officeRules: { ...ev.officeRules, ...(f.consentRate !== undefined ? { consentRate: f.consentRate } : {}), ...(f.safetyStaff !== undefined ? { safetyStaff: f.safetyStaff } : {}) } } : {}),
  };
}

/** 고친 값을 저장하고 "마지막으로 고친 날짜"를 남긴다. value 가 null 이면 원래 값으로 되돌린다 */
export function setEdit<K extends Exclude<keyof Edits, "meta">>(prev: ExtState, kind: K, id: string, value: Edits[K][string] | null, today: DateString): Partial<ExtState> {
  const edits = prev.edits ?? EMPTY_EDITS;
  const group = { ...(edits[kind] as Record<string, unknown>) };
  const meta = { ...edits.meta };
  if (value === null) { delete group[id]; delete meta[`${kind}:${id}`]; } else { group[id] = value; meta[`${kind}:${id}`] = today; }
  return { edits: { ...edits, [kind]: group, meta } };
}
export const editedAt = (edits: Edits | undefined, kind: string, id: string) => edits?.meta?.[`${kind}:${id}`];
export const eventBudget = (eventId: string, o: ExtOverlay = overlay) => allBudgets(o).find((b) => b.id === getExt(eventId, o).budgetId);
export const findVenue = (id: string, o: ExtOverlay = overlay) => allVenues(o).find((v) => v.id === id);
export const getRecord = (eventId: string, o: ExtOverlay = overlay): HandoverRecord | null =>
  o.addedRecords?.[eventId] ?? staticRecords[eventId] ?? null;

/** 기본 행사 + 데모용 진로 행사 + 업로드로 추가한 행사 */
export function allEvents(state: Pick<ClientState, "addedEvents">): EventCard[] {
  return eventsWithAdded({ addedEvents: [...extraEvents, ...state.addedEvents] });
}

/** 진로 필터: 선택한 계열이거나 공통(태그 없음) 행사 */
export const matchTrack = (eventId: string, track: string) => {
  const t = getExt(eventId).careerTracks;
  return track === "전체" || t.length === 0 || t.includes(track);
};

export type ExtraStep = { id: "settle" | "disclose"; key: string; label: string; dueDate: DateString; done: boolean };
/** 수익자부담 행사에 자동으로 붙는 정산 마감·학부모 공개 단계 */
export function settlementSteps(event: EventCard, state: ClientState, ext: ExtState): ExtraStep[] {
  const st = eventBudget(event.id)?.settlement;
  if (!st) return [];
  const date = effectiveEventDate(event, state);
  const settleDue = addDays(date, st.dueDaysAfterEvent);
  return [
    { id: "settle" as const, key: `${event.id}:settle`, label: `정산 마감(행사 후 ${st.dueDaysAfterEvent}일)`, dueDate: settleDue },
    { id: "disclose" as const, key: `${event.id}:disclose`, label: "수익자부담 정산 학부모 공개", dueDate: addDays(settleDue, st.disclosureDaysAfterSettlement) },
  ].map((x) => ({ ...x, done: !!ext.extraDone[x.key] }));
}

export const won = (n: number) => {
  const a = Math.abs(n);
  return `${n < 0 ? "-" : ""}${a >= 10000 ? `${Math.round(a / 10000).toLocaleString()}만원` : `${a.toLocaleString()}원`}`;
};
export const mmdd = (s: string) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`;
