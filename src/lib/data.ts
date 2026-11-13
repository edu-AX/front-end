import eventsJson from "@/data/events.json";
import templatesJson from "@/data/templates.json";
import guidelinesJson from "@/data/guidelines.json";
import changesJson from "@/data/changes.json";

export type EventItem = {
  id: string; title: string; scope: "교내" | "교외"; eventDate: string; grade: number;
  participants: number; template: "OUT_OVERNIGHT" | "OUT_DAY" | "IN";
  officeRules?: { office: string; consentRate: string; safetyStaff: string; sourceId: string };
  handoverNotes: { year: number; note: string }[];
  stepStatus: Record<string, string>; changeAlertIds: string[];
};
export type Guideline = { id: string; title: string; year: number; status: "시행" | "추진 중"; scope: string; sections: string[]; sourceUrl: string };
export type Change = { id: string; eventId: string; title: string; before: string; after: string; status: "시행" | "추진 중"; source: string; sourceId: string; url: string };
export type Persist = {
  done: Record<string, boolean>; dates: Record<string, string>;
  confirmed: Record<string, boolean>; notes: Record<string, string>;
  charPos: { x: number; y: number } | null; hidden: boolean;
};

export const events = eventsJson as unknown as EventItem[];
export const templates = templatesJson as unknown as Record<string, { label: string; steps: { id: string; label: string; offset: number }[] }>;
export const guidelines = guidelinesJson as unknown as Guideline[];
export const changes = changesJson as unknown as Change[];

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

export const eventDate = (ev: EventItem, s: Persist) => s.dates[ev.id] ?? ev.eventDate;

export type Step = { id: string; key: string; label: string; offset: number; due: string; done: boolean };
export function buildSteps(ev: EventItem, s: Persist): Step[] {
  const date = eventDate(ev, s);
  return templates[ev.template].steps.map((st) => {
    const key = `${ev.id}:${st.id}`;
    const done = key in s.done ? s.done[key] : ev.stepStatus[st.id] === "done";
    return { ...st, key, due: addDays(date, st.offset), done };
  });
}
export const progress = (ev: EventItem, s: Persist) => {
  const st = buildSteps(ev, s);
  return Math.round((st.filter((x) => x.done).length / st.length) * 100);
};
export const nextStep = (ev: EventItem, s: Persist) => buildSteps(ev, s).find((x) => !x.done);
export const activeChanges = (ev: EventItem, s: Persist) =>
  ev.changeAlertIds.map((id) => changes.find((c) => c.id === id)).filter((c): c is Change => !!c && !s.confirmed[`${ev.id}:${c.id}`]);
