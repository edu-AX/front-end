// 업로드 검토 화면(6탭)의 폼 모델. AI 초안(EventDraft) ↔ 화면 입력값 변환과 항목별 상태(AI 작성/확인함/비어 있음) 계산.
// 화면 전용 파일이라 front-end 에만 있다. 공유 파일(types·draft·masking)은 back-end 에서 sync 로 받는다.
import { maskPersonalInfo } from "./masking";
import type { DraftCandidate, EventDraft, Scope, TemplateId } from "./types";

export type ReviewTab = "handover" | "budget" | "venue" | "record" | "owner" | "career";
export type FieldStatus = "ai" | "ok" | "empty";

export const REVIEW_TABS: { key: ReviewTab; label: string }[] = [
  { key: "handover", label: "인수인계" },
  { key: "budget", label: "예산" },
  { key: "venue", label: "장소" },
  { key: "record", label: "고민 기록" },
  { key: "owner", label: "담당 이력" },
  { key: "career", label: "진로·과목" },
];

export const CAREER_TRACKS = ["인문", "사회", "교육", "공학", "자연", "의약", "예체능"] as const;
export const CANDIDATE_KINDS: DraftCandidate["kind"][] = ["장소", "업체", "프로그램", "일정"];

let seq = 0;
export const newUid = () => `r${Date.now().toString(36)}${++seq}`;

export type UForm = {
  title: string;
  scope: Scope;
  template: TemplateId;
  eventDate: string | null;
  nextDate: string;
  steps: EventDraft["steps"];
  /** offset: 행사일 기준 일수(음수 = 행사 전) 입력값 */
  customSteps: { uid: string; id: string; label: string; offset: string; memo: string }[];
  cautions: { uid: string; text: string }[];
  handoverNote: string;
  budget: {
    total: string; perStudent: string; memo: string;
    sources: { uid: string; type: string; amount: string }[];
    items: { uid: string; name: string; amount: string }[];
  };
  venues: { uid: string; name: string; type: string; memo: string; rating: string }[];
  candidates: { uid: string; kind: DraftCandidate["kind"]; name: string; chosen: boolean; reason: string }[];
  skipped: { uid: string; text: string }[];
  career: { tracks: string[]; subjects: string; creativeArea: string; target: string };
  owner: { good: string; problem: string; nextYear: string };
};

const s = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));
/** "1,800,000원" → 1800000, 비어 있으면 null */
export const toAmount = (v: string): number | null => {
  const t = v.replace(/[,\s원]/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};

export function fromDraft(d: EventDraft, nextDate: string): UForm {
  const b = d.budget;
  return {
    title: d.title,
    scope: d.scope,
    template: d.template,
    eventDate: d.eventDate,
    nextDate,
    steps: d.steps.map((x) => ({ ...x })),
    customSteps: (d.customSteps ?? []).map((c) => ({ uid: newUid(), id: c.id, label: c.label, offset: String(c.offsetDays), memo: c.memo ?? "" })),
    cautions: d.cautions.map((text) => ({ uid: newUid(), text })),
    handoverNote: d.handoverNote,
    budget: {
      total: s(b?.total), perStudent: s(b?.perStudent), memo: b?.memo ?? "",
      sources: (b?.sources ?? []).map((x) => ({ uid: newUid(), type: x.type, amount: s(x.amount) })),
      items: (b?.items ?? []).map((x) => ({ uid: newUid(), name: x.name, amount: s(x.amount) })),
    },
    venues: (d.venues ?? []).map((v) => ({ uid: newUid(), name: v.name, type: v.type, memo: v.memo, rating: s(v.rating) })),
    candidates: (d.candidates ?? []).map((c) => ({ uid: newUid(), ...c })),
    skipped: (d.skipped ?? []).map((text) => ({ uid: newUid(), text })),
    career: {
      tracks: d.career?.tracks ?? [],
      subjects: (d.career?.subjects ?? []).join(", "),
      creativeArea: d.career?.creativeArea ?? "",
      target: d.career?.target ?? "",
    },
    owner: { good: d.ownerNote?.good ?? "", problem: d.ownerNote?.problem ?? "", nextYear: d.ownerNote?.nextYear ?? "" },
  };
}

/** 화면에 보이는 항목 목록 (상태 배지·개수 계산용). empty = 지금 값이 비어 있음 */
export function reviewFields(f: UForm): { key: string; tab: ReviewTab; empty: boolean }[] {
  const out: { key: string; tab: ReviewTab; empty: boolean }[] = [];
  const add = (key: string, tab: ReviewTab, empty: boolean) => out.push({ key, tab, empty });
  const blank = (v: string) => !v.trim();

  add("title", "handover", blank(f.title));
  for (const st of f.steps) add(`step:${st.stepId}`, "handover", !st.actualDate && blank(st.memo));
  for (const c of f.customSteps) add(`custom:${c.uid}`, "handover", blank(c.label));
  if (f.cautions.length === 0) add("cautions", "handover", true);
  for (const c of f.cautions) add(`caution:${c.uid}`, "handover", blank(c.text));
  add("handoverNote", "handover", blank(f.handoverNote));

  add("budget.total", "budget", toAmount(f.budget.total) === null);
  add("budget.perStudent", "budget", toAmount(f.budget.perStudent) === null);
  if (f.budget.sources.length === 0) add("sources", "budget", true);
  for (const x of f.budget.sources) add(`src:${x.uid}`, "budget", blank(x.type) || toAmount(x.amount) === null);
  if (f.budget.items.length === 0) add("items", "budget", true);
  for (const x of f.budget.items) add(`item:${x.uid}`, "budget", blank(x.name) || toAmount(x.amount) === null);
  add("budget.memo", "budget", blank(f.budget.memo));

  if (f.venues.length === 0) add("venues", "venue", true);
  for (const v of f.venues) add(`venue:${v.uid}`, "venue", blank(v.name));

  if (f.candidates.length === 0) add("cands", "record", true);
  for (const c of f.candidates) add(`cand:${c.uid}`, "record", blank(c.name));
  if (f.skipped.length === 0) add("skips", "record", true);
  for (const x of f.skipped) add(`skip:${x.uid}`, "record", blank(x.text));

  add("owner.good", "owner", blank(f.owner.good));
  add("owner.problem", "owner", blank(f.owner.problem));
  add("owner.nextYear", "owner", blank(f.owner.nextYear));

  add("career.tracks", "career", f.career.tracks.length === 0);
  add("career.subjects", "career", blank(f.career.subjects));
  add("career.creativeArea", "career", blank(f.career.creativeArea));
  add("career.target", "career", blank(f.career.target));
  return out;
}

export const fieldStatus = (empty: boolean, confirmed: boolean): FieldStatus => (empty ? "empty" : confirmed ? "ok" : "ai");

export function reviewCounts(f: UForm, confirmed: ReadonlySet<string>) {
  const c = { ai: 0, ok: 0, empty: 0 };
  for (const x of reviewFields(f)) c[fieldStatus(x.empty, confirmed.has(x.key))]++;
  return c;
}

/** 저장 조건: 주의점 중 하나 이상을 담당자가 확인함 */
export const hasConfirmedCaution = (f: UForm, confirmed: ReadonlySet<string>) =>
  f.cautions.some((c) => c.text.trim() && confirmed.has(`caution:${c.uid}`));

/** 화면 입력값 → 저장할 초안. 담당자가 고친 글도 한 번 더 가린다 (이름·전화번호) */
export function toDraft(f: UForm): EventDraft {
  const m = (v: string) => maskPersonalInfo(v.trim()).maskedText;
  const sources = f.budget.sources.filter((x) => x.type.trim()).map((x) => ({ type: m(x.type), amount: toAmount(x.amount) }));
  const items = f.budget.items.filter((x) => x.name.trim()).map((x) => ({ name: m(x.name), amount: toAmount(x.amount) }));
  const total = toAmount(f.budget.total);
  const perStudent = toAmount(f.budget.perStudent);
  const budgetEmpty = total === null && perStudent === null && !sources.length && !items.length && !f.budget.memo.trim();
  const subjects = f.career.subjects.split(/[,，·]/).map((x) => x.trim()).filter(Boolean);
  const careerEmpty = !f.career.tracks.length && !subjects.length && !f.career.creativeArea.trim() && !f.career.target.trim();
  const ownerEmpty = !f.owner.good.trim() && !f.owner.problem.trim() && !f.owner.nextYear.trim();

  return {
    title: m(f.title),
    scope: f.scope,
    template: f.template,
    eventDate: f.eventDate,
    steps: f.steps.map((x) => ({ stepId: x.stepId, actualDate: x.actualDate || null, memo: m(x.memo) })),
    cautions: f.cautions.map((c) => m(c.text)).filter(Boolean),
    handoverNote: m(f.handoverNote),
    budget: budgetEmpty ? null : { total, perStudent, sources, items, memo: m(f.budget.memo) },
    venues: f.venues.filter((v) => v.name.trim()).map((v) => {
      const r = Number(v.rating);
      return { name: m(v.name), type: m(v.type), memo: m(v.memo), rating: v.rating.trim() && r >= 1 && r <= 5 ? Math.round(r) : null };
    }),
    candidates: f.candidates.filter((c) => c.name.trim()).map((c) => ({ kind: c.kind, name: m(c.name), chosen: c.chosen, reason: m(c.reason) })),
    skipped: f.skipped.map((x) => m(x.text)).filter(Boolean),
    customSteps: f.customSteps
      .filter((c) => c.label.trim() && Number.isFinite(Number(c.offset)) && c.offset.trim() !== "")
      .map((c) => ({ id: c.id as `custom-${string}`, label: m(c.label), offsetDays: Math.round(Number(c.offset)), ...(c.memo.trim() ? { memo: m(c.memo) } : {}) })),
    career: careerEmpty ? null : { tracks: f.career.tracks, subjects: subjects.map(m), creativeArea: m(f.career.creativeArea), target: m(f.career.target) },
    ownerNote: ownerEmpty ? null : { good: m(f.owner.good), problem: m(f.owner.problem), nextYear: m(f.owner.nextYear) },
  };
}
