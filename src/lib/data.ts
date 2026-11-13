import eventsJson from "@/data/events.json";
import templatesJson from "@/data/templates.json";
import guidelinesJson from "@/data/guidelines.json";
import changesJson from "@/data/changes.json";
import budgetsJson from "@/data/budgets.json";
import venuesJson from "@/data/venues.json";
import careerJson from "@/data/careerTracks.json";
import checklistJson from "@/data/safetyChecklists.json";

export type Owner = {
  year: number; role: string; name: string | null; consentToShow: boolean; contact: string | null;
  notes: { good: string; problem: string; nextYear: string };
};
export type EventItem = {
  id: string; title: string; scope: "교내" | "교외"; eventDate: string; grade: number;
  participants: number; template: "OUT_OVERNIGHT" | "OUT_DAY" | "IN";
  officeRules?: { office: string; consentRate: string; safetyStaff: string; sourceId: string };
  careerTracks: string[]; linkedSubjects: string[]; creativeArea: string; target: string;
  budgetId: string | null; venueIds: string[]; ownerHistory: Owner[];
  handoverNotes: { year: number; note: string }[];
  stepStatus: Record<string, string>; changeAlertIds: string[];
};
export type Guideline = { id: string; title: string; year: number; status: "시행" | "추진 중"; scope: string; sections: string[]; sourceUrl: string };
export type Change = { id: string; eventId: string; title: string; before: string; after: string; status: "시행" | "추진 중"; source: string; sourceId: string; url: string };
export type BudgetSource = { type: string; planned: number; spent: number; transferable: boolean; perStudent?: number };
export type Budget = {
  id: string; eventId: string; year: number; sources: BudgetSource[]; items: { name: string; planned: number }[];
  settlement: { dueDaysAfterEvent: number; disclosureDaysAfterSettlement: number; officeSource: string } | null;
  lastYear: { total: number; perStudent: number | null; memo: string };
};
export type Venue = {
  id: string; name: string; type: string; address: string; travelMinutes: number; busParking: string; capacity: number; lastInspectionYear: number;
  safetyChecks: { item: string; result: string; checkedAt: string; evidence: string }[];
  emergency: { hospital: string; fire: string; police: string }; vendor: { name: string; contract: string };
  history: { year: number; eventId: string; rating: number; memo: string }[];
};
export type Persist = {
  done: Record<string, boolean>; dates: Record<string, string>;
  confirmed: Record<string, boolean>; notes: Record<string, string>;
  charPos: { x: number; y: number } | null; hidden: boolean;
};

export const events = eventsJson as unknown as EventItem[];
export const templates = templatesJson as unknown as Record<string, { label: string; steps: { id: string; label: string; offset: number }[] }>;
export const guidelines = guidelinesJson as unknown as Guideline[];
export const changes = changesJson as unknown as Change[];
export const budgets = budgetsJson as unknown as Budget[];
export const venues = venuesJson as unknown as Venue[];
export const tracks = careerJson.tracks as string[];
export const studentCounts = careerJson.studentCounts as unknown as Record<string, Record<string, number>>;
export const safetyChecklists = checklistJson as unknown as Record<string, string[]>;

export const eventBudget = (ev: EventItem) => budgets.find((b) => b.id === ev.budgetId);

/** 데모 기준일: 수학여행(2027-05-12)이 D-62로 보이도록 고정 */
export const DEMO_TODAY = "2027-03-11";

const DAY = 86400000;
export const parse = (s: string) => new Date(s + "T00:00:00Z");
export const fmt = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => fmt(new Date(parse(s).getTime() + n * DAY));
export const diffDays = (a: string, b: string) => Math.round((parse(a).getTime() - parse(b).getTime()) / DAY);
export const dday = (date: string) => diffDays(date, DEMO_TODAY);
export const ddayLabel = (n: number) => (n === 0 ? "D-day" : n > 0 ? `D-${n}` : `D+${-n}`);
export const mmdd = (s: string) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`;
export const won = (n: number) => (n >= 10000 ? `${Math.round(n / 10000).toLocaleString()}만원` : `${n.toLocaleString()}원`);

export const eventDate = (ev: EventItem, s: Persist) => s.dates[ev.id] ?? ev.eventDate;

export type Step = { id: string; key: string; label: string; offset: number; due: string; done: boolean };
export function buildSteps(ev: EventItem, s: Persist): Step[] {
  const date = eventDate(ev, s);
  const base = [...templates[ev.template].steps];
  const st = eventBudget(ev)?.settlement;
  if (st) {
    base.push({ id: "settle", label: `정산 마감(행사 후 ${st.dueDaysAfterEvent}일)`, offset: st.dueDaysAfterEvent });
    base.push({ id: "disclose", label: "수익자부담 정산 학부모 공개", offset: st.dueDaysAfterEvent + st.disclosureDaysAfterSettlement });
  }
  base.sort((a, b) => a.offset - b.offset);
  return base.map((x) => {
    const key = `${ev.id}:${x.id}`;
    const done = key in s.done ? s.done[key] : ev.stepStatus[x.id] === "done";
    return { ...x, key, due: addDays(date, x.offset), done };
  });
}
export const progress = (ev: EventItem, s: Persist) => {
  const st = buildSteps(ev, s);
  return Math.round((st.filter((x) => x.done).length / st.length) * 100);
};
export const nextStep = (ev: EventItem, s: Persist) => buildSteps(ev, s).find((x) => !x.done);
export const activeChanges = (ev: EventItem, s: Persist) =>
  ev.changeAlertIds.map((id) => changes.find((c) => c.id === id)).filter((c): c is Change => !!c && !s.confirmed[`${ev.id}:${c.id}`]);

/** 진로 필터: 선택한 계열이거나 공통(태그 없음) 행사 */
export const matchTrack = (ev: EventItem, track: string) => track === "전체" || ev.careerTracks.length === 0 || ev.careerTracks.includes(track);
