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
};
export const EMPTY_EXT_STATE: ExtState = {
  extraDone: {}, charPos: null, hidden: false,
  addedExt: {}, addedBudgets: [], addedVenues: [], addedRecords: {},
};
export type ExtOverlay = Pick<ExtState, "addedExt" | "addedBudgets" | "addedVenues" | "addedRecords">;

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

export const getExt = (eventId: string, o: ExtOverlay = overlay): EventExt => o.addedExt?.[eventId] ?? extEvents[eventId] ?? EMPTY_EXT;
export const allBudgets = (o: ExtOverlay = overlay): Budget[] => [...budgets, ...(o.addedBudgets ?? [])];
export const allVenues = (o: ExtOverlay = overlay): Venue[] => [...venues, ...(o.addedVenues ?? [])];
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

export const won = (n: number) => (n >= 10000 ? `${Math.round(n / 10000).toLocaleString()}만원` : `${n.toLocaleString()}원`);
export const mmdd = (s: string) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`;
