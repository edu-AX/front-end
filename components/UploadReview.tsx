"use client";
// 업로드 3단계: AI가 채운 초안을 6탭으로 검토·수정. 항목마다 AI 작성 / 확인함 / 비어 있음 배지.
import { useMemo, useRef, useState, type ReactNode } from "react";
import { getTemplate } from "@/lib/data";
import type { EventDraft, TemplateId } from "@/lib/types";
import {
  CANDIDATE_KINDS, CAREER_TRACKS, fieldStatus, fromDraft, hasConfirmedCaution, newUid, REVIEW_TABS, reviewCounts, reviewFields, toDraft,
  type FieldStatus, type ReviewTab, type UForm,
} from "@/lib/uploadForm";

const TEMPLATE_LABEL: Record<TemplateId, string> = { OUT_OVERNIGHT: "교외 숙박형", OUT_DAY: "교외 1일형", IN_SCHOOL: "교내 행사" };
const input = "w-full rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-sm";
const small = "rounded-xl border border-stone-200 bg-white px-2 py-1 text-sm";
const dLabel = (n: number) => (n === 0 ? "D-day" : n < 0 ? `D${n}` : `D+${n}`);

function Badge({ s, onOk }: { s: FieldStatus; onOk: () => void }) {
  if (s === "empty")
    return <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-stone-500">비어 있음 · 문서에서 찾지 못했어요</span>;
  if (s === "ok") return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">✓ 확인함</span>;
  return (
    <span className="flex items-center gap-1">
      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">AI 작성</span>
      <button type="button" onClick={onOk} title="맞아요, 확인했어요" className="rounded-full border border-emerald-300 bg-white px-2 py-0.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-50">✓ 확인</button>
    </span>
  );
}

export default function UploadReview({ draft, initialNextDate, mode, onSave }: {
  draft: EventDraft; initialNextDate: string; mode: string; onSave: (draft: EventDraft, nextDate: string) => void;
}) {
  const [f, setF] = useState<UForm>(() => fromDraft(draft, initialNextDate));
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<ReviewTab>("handover");
  // 처음에 AI가 채운 항목 수 (헤더 문구)
  const [filled] = useState(() => reviewFields(fromDraft(draft, initialNextDate)).filter((x) => !x.empty).length);

  const fields = useMemo(() => reviewFields(f), [f]);
  const emptyOf = useMemo(() => new Map(fields.map((x) => [x.key, x.empty])), [fields]);
  const counts = reviewCounts(f, confirmed);
  const cautionOk = hasConfirmedCaution(f, confirmed);
  // 저장이 막힌 이유 (없으면 저장 가능). 버튼은 항상 눌리고, 막혔으면 이유를 보여주고 그 자리로 데려간다
  const blocked = !f.title.trim() ? "행사명을 적어 주세요"
    : !f.nextDate ? "내년 행사일을 골라 주세요"
    : !cautionOk ? (f.cautions.some((c) => c.text.trim()) ? "주의점 하나에 ✓ 확인을 눌러 주세요" : "주의점을 하나 적어 주세요")
    : null;
  const [showWhy, setShowWhy] = useState(false);
  const titleRef = useRef<HTMLDivElement>(null);
  const cautionRef = useRef<HTMLDivElement>(null);
  const trySave = () => {
    if (!blocked) return onSave(toDraft(f), f.nextDate);
    setShowWhy(true);
    setTab("handover");
    // 탭이 바뀐 뒤 그려진 자리로 스크롤
    const target = f.title.trim() && f.nextDate ? cautionRef : titleRef;
    requestAnimationFrame(() => target.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };
  const tpl = getTemplate(f.template);

  const confirm = (key: string) => setConfirmed((p) => (p.has(key) ? p : new Set(p).add(key)));
  /** 값을 고치면 그 항목은 담당자가 확인한 것으로 */
  const upd = (key: string, fn: (p: UForm) => UForm) => { setF(fn); confirm(key); };
  const st = (key: string) => fieldStatus(emptyOf.get(key) ?? true, confirmed.has(key));
  const head = (key: string, label: ReactNode) => (
    <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
      <span className="text-xs font-bold text-stone-500">{label}</span>
      <Badge s={st(key)} onOk={() => confirm(key)} />
    </div>
  );
  const box = (key: string, children: ReactNode, extra = "") => (
    <div key={key} className={`rounded-2xl bg-white p-3 shadow-sm ${st(key) === "ok" ? "ring-1 ring-emerald-200" : ""} ${extra}`}>{children}</div>
  );
  const removeBtn = (onClick: () => void) => (
    <button type="button" onClick={onClick} className="shrink-0 rounded-full px-2 text-xs text-stone-400 hover:bg-stone-100" aria-label="지우기">✕</button>
  );
  const addBtn = (label: string, onClick: () => void) => (
    <button type="button" onClick={onClick} className="w-full rounded-xl border border-dashed border-stone-300 py-1.5 text-xs text-stone-500 hover:bg-white">+ {label}</button>
  );
  const emptySection = (key: string, label: string) => box(key, head(key, label));
  const tabCount = (t: ReviewTab) => fields.filter((x) => x.tab === t && !x.empty).length;

  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-2xl bg-violet-50 p-3">
        <div className="font-bold text-violet-900">AI가 문서에서 {filled}개 항목을 채웠어요. 확인하고 고쳐 주세요</div>
        <div className="mt-1 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-violet-100 px-2 py-0.5 font-bold text-violet-700">AI 작성 {counts.ai}</span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-700">확인함 {counts.ok}</span>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-500">비어 있음 {counts.empty}</span>
        </div>
        {mode !== "llm" && <p className="mt-2 text-[11px] text-amber-700">데모 초안이에요(mode: {mode}). AI 연결 시 올린 문서 내용으로 만들어져요.</p>}
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1" role="tablist">
        {REVIEW_TABS.map((t) => {
          const n = tabCount(t.key);
          return (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${tab === t.key ? "bg-stone-800 text-white" : n ? "bg-white text-stone-600 shadow-sm" : "bg-white/60 text-stone-400"}`}>
              {t.label} <span className={tab === t.key ? "text-stone-300" : "text-stone-400"}>{n}</span>
            </button>
          );
        })}
      </div>

      {tab === "handover" && (
        <div ref={titleRef} className="space-y-2">
          {box("title", <>
            {head("title", "행사명")}
            <input className={input} value={f.title} onChange={(e) => upd("title", (p) => ({ ...p, title: e.target.value }))} />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <select className={input} value={f.scope} onChange={(e) => setF((p) => ({ ...p, scope: e.target.value as UForm["scope"] }))} aria-label="구분"><option>교내</option><option>교외</option></select>
              <select className={input} value={f.template} onChange={(e) => setF((p) => ({ ...p, template: e.target.value as TemplateId }))} aria-label="유형">
                {(Object.keys(TEMPLATE_LABEL) as TemplateId[]).map((t) => <option key={t} value={t}>{TEMPLATE_LABEL[t]}</option>)}
              </select>
            </div>
            <label className="mt-2 block text-xs text-stone-500">내년 행사일 (문서의 행사일: {f.eventDate ?? "알 수 없음"})
              <input type="date" className={input} value={f.nextDate} onChange={(e) => setF((p) => ({ ...p, nextDate: e.target.value }))} /></label>
          </>)}

          <div ref={cautionRef} className="pt-1 text-xs font-bold text-stone-500">주의점 — 다음 담당자가 “인수인계 받기”에서 꼭 보게 돼요</div>
          {f.cautions.length === 0 && emptySection("cautions", "주의점")}
          {f.cautions.map((c, i) => box(`caution:${c.uid}`, <>
            {head(`caution:${c.uid}`, `주의점 ${i + 1}`)}
            <div className="flex gap-1">
              <textarea className={`${input} h-14`} value={c.text}
                onChange={(e) => upd(`caution:${c.uid}`, (p) => ({ ...p, cautions: p.cautions.map((x) => (x.uid === c.uid ? { ...x, text: e.target.value } : x)) }))} />
              {removeBtn(() => setF((p) => ({ ...p, cautions: p.cautions.filter((x) => x.uid !== c.uid) })))}
            </div>
          </>, "bg-amber-50"))}
          {addBtn("주의점 추가", () => setF((p) => ({ ...p, cautions: [...p.cautions, { uid: newUid(), text: "" }] })))}
          {!cautionOk && (
            <p className={`rounded-xl px-3 py-2 text-xs font-bold ${showWhy ? "bg-red-100 text-red-700 ring-2 ring-red-300" : "bg-amber-100 text-amber-800"}`}>다음 담당자에게 꼭 전하고 싶은 한 가지를 확인해 주세요 (주의점의 ✓ 확인)</p>
          )}

          {box("handoverNote", <>
            {head("handoverNote", "내년엔 이렇게 (학생 이름·연락처는 적지 마세요)")}
            <textarea className={`${input} h-16`} value={f.handoverNote} onChange={(e) => upd("handoverNote", (p) => ({ ...p, handoverNote: e.target.value }))} />
          </>)}

          <div className="pt-1 text-xs font-bold text-stone-500">단계별 작년 실제 날짜·메모 → 내년 체크리스트 “작년엔 ~”</div>
          {f.steps.map((s) => {
            const key = `step:${s.stepId}`;
            const label = tpl.steps.find((t) => t.id === s.stepId)?.label ?? s.stepId;
            return box(key, <>
              {head(key, label)}
              <div className="flex gap-2">
                <input type="date" className={small} value={s.actualDate ?? ""} aria-label={`${label} 날짜`}
                  onChange={(e) => upd(key, (p) => ({ ...p, steps: p.steps.map((x) => (x.stepId === s.stepId ? { ...x, actualDate: e.target.value || null } : x)) }))} />
                <input className={`${small} min-w-0 flex-1`} value={s.memo} placeholder="메모" aria-label={`${label} 메모`}
                  onChange={(e) => upd(key, (p) => ({ ...p, steps: p.steps.map((x) => (x.stepId === s.stepId ? { ...x, memo: e.target.value } : x)) }))} />
              </div>
            </>);
          })}

          <div className="pt-1 text-xs font-bold text-stone-500">템플릿에 없는 단계 (우리 학교에만 있는 단계)</div>
          {f.customSteps.map((c) => {
            const key = `custom:${c.uid}`;
            const n = Number(c.offset);
            return box(key, <>
              {head(key, <>추가 단계 {c.offset.trim() !== "" && Number.isFinite(n) && <span className="text-sky-700">({dLabel(Math.round(n))})</span>}</>)}
              <div className="flex flex-wrap items-center gap-2">
                <input className={`${small} min-w-0 flex-1`} value={c.label} placeholder="단계 이름" aria-label="추가 단계 이름"
                  onChange={(e) => upd(key, (p) => ({ ...p, customSteps: p.customSteps.map((x) => (x.uid === c.uid ? { ...x, label: e.target.value } : x)) }))} />
                <label className="flex items-center gap-1 text-xs text-stone-500">행사일 기준
                  <input type="number" className={`${small} w-16`} value={c.offset} aria-label="행사일 기준 일수"
                    onChange={(e) => upd(key, (p) => ({ ...p, customSteps: p.customSteps.map((x) => (x.uid === c.uid ? { ...x, offset: e.target.value } : x)) }))} />일
                </label>
                {removeBtn(() => setF((p) => ({ ...p, customSteps: p.customSteps.filter((x) => x.uid !== c.uid) })))}
              </div>
              <input className={`${small} mt-1 w-full`} value={c.memo} placeholder="메모 (선택)" aria-label="추가 단계 메모"
                onChange={(e) => upd(key, (p) => ({ ...p, customSteps: p.customSteps.map((x) => (x.uid === c.uid ? { ...x, memo: e.target.value } : x)) }))} />
            </>, "bg-sky-50")
          })}
          {addBtn("단계 추가", () => setF((p) => ({ ...p, customSteps: [...p.customSteps, { uid: newUid(), id: `custom-doc-${Date.now().toString(36)}`, label: "", offset: "-14", memo: "" }] })))}
        </div>
      )}

      {tab === "budget" && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {box("budget.total", <>{head("budget.total", "총액(원)")}
              <input inputMode="numeric" className={input} value={f.budget.total} onChange={(e) => upd("budget.total", (p) => ({ ...p, budget: { ...p.budget, total: e.target.value } }))} /></>)}
            {box("budget.perStudent", <>{head("budget.perStudent", "1인당(원)")}
              <input inputMode="numeric" className={input} value={f.budget.perStudent} onChange={(e) => upd("budget.perStudent", (p) => ({ ...p, budget: { ...p.budget, perStudent: e.target.value } }))} /></>)}
          </div>
          <div className="pt-1 text-xs font-bold text-stone-500">재원</div>
          {f.budget.sources.length === 0 && emptySection("sources", "재원")}
          {f.budget.sources.map((x) => {
            const key = `src:${x.uid}`;
            const set = (patch: Partial<typeof x>) => upd(key, (p) => ({ ...p, budget: { ...p.budget, sources: p.budget.sources.map((y) => (y.uid === x.uid ? { ...y, ...patch } : y)) } }));
            return box(key, <>{head(key, x.type || "재원")}
              <div className="flex gap-2">
                <input className={`${small} min-w-0 flex-1`} value={x.type} placeholder="학교회계 / 수익자부담 …" onChange={(e) => set({ type: e.target.value })} aria-label="재원 종류" />
                <input inputMode="numeric" className={`${small} w-28`} value={x.amount} placeholder="금액" onChange={(e) => set({ amount: e.target.value })} aria-label="재원 금액" />
                {removeBtn(() => setF((p) => ({ ...p, budget: { ...p.budget, sources: p.budget.sources.filter((y) => y.uid !== x.uid) } })))}
              </div></>);
          })}
          {addBtn("재원 추가", () => setF((p) => ({ ...p, budget: { ...p.budget, sources: [...p.budget.sources, { uid: newUid(), type: "", amount: "" }] } })))}
          <div className="pt-1 text-xs font-bold text-stone-500">항목별 집행</div>
          {f.budget.items.length === 0 && emptySection("items", "항목")}
          {f.budget.items.map((x) => {
            const key = `item:${x.uid}`;
            const set = (patch: Partial<typeof x>) => upd(key, (p) => ({ ...p, budget: { ...p.budget, items: p.budget.items.map((y) => (y.uid === x.uid ? { ...y, ...patch } : y)) } }));
            return box(key, <>{head(key, x.name || "항목")}
              <div className="flex gap-2">
                <input className={`${small} min-w-0 flex-1`} value={x.name} placeholder="교통 / 식비 …" onChange={(e) => set({ name: e.target.value })} aria-label="항목 이름" />
                <input inputMode="numeric" className={`${small} w-28`} value={x.amount} placeholder="금액" onChange={(e) => set({ amount: e.target.value })} aria-label="항목 금액" />
                {removeBtn(() => setF((p) => ({ ...p, budget: { ...p.budget, items: p.budget.items.filter((y) => y.uid !== x.uid) } })))}
              </div></>);
          })}
          {addBtn("항목 추가", () => setF((p) => ({ ...p, budget: { ...p.budget, items: [...p.budget.items, { uid: newUid(), name: "", amount: "" }] } })))}
          {box("budget.memo", <>{head("budget.memo", "예산 메모")}
            <input className={input} value={f.budget.memo} onChange={(e) => upd("budget.memo", (p) => ({ ...p, budget: { ...p.budget, memo: e.target.value } }))} /></>)}
        </div>
      )}

      {tab === "venue" && (
        <div className="space-y-2">
          {f.venues.length === 0 && emptySection("venues", "장소")}
          {f.venues.map((v) => {
            const key = `venue:${v.uid}`;
            const set = (patch: Partial<typeof v>) => upd(key, (p) => ({ ...p, venues: p.venues.map((y) => (y.uid === v.uid ? { ...y, ...patch } : y)) }));
            return box(key, <>{head(key, v.name || "장소")}
              <div className="flex gap-2">
                <input className={`${small} min-w-0 flex-1`} value={v.name} placeholder="장소 이름" onChange={(e) => set({ name: e.target.value })} aria-label="장소 이름" />
                <input className={`${small} w-28`} value={v.type} placeholder="종류" onChange={(e) => set({ type: e.target.value })} aria-label="장소 종류" />
                <select className={small} value={v.rating} onChange={(e) => set({ rating: e.target.value })} aria-label="평점">
                  <option value="">평점 없음</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
                </select>
                {removeBtn(() => setF((p) => ({ ...p, venues: p.venues.filter((y) => y.uid !== v.uid) })))}
              </div>
              <input className={`${small} mt-1 w-full`} value={v.memo} placeholder="메모" onChange={(e) => set({ memo: e.target.value })} aria-label="장소 메모" />
            </>);
          })}
          {addBtn("장소 추가", () => setF((p) => ({ ...p, venues: [...p.venues, { uid: newUid(), name: "", type: "", memo: "", rating: "" }] })))}
          <p className="text-[11px] text-stone-400">주소·수용 인원·점검 연도처럼 문서에 없는 값은 카드에 “문서에 없음”으로 남아요.</p>
        </div>
      )}

      {tab === "record" && (
        <div className="space-y-2">
          <p className="text-[11px] text-stone-500">결과보고서엔 잘 안 남는 “왜 다른 걸 안 골랐는지”예요. 내년 담당자가 같은 고민을 반복하지 않게 해 줘요.</p>
          {f.candidates.length === 0 && emptySection("cands", "후보 비교")}
          {f.candidates.map((c) => {
            const key = `cand:${c.uid}`;
            const set = (patch: Partial<typeof c>) => upd(key, (p) => ({ ...p, candidates: p.candidates.map((y) => (y.uid === c.uid ? { ...y, ...patch } : y)) }));
            return box(key, <>{head(key, <span className={c.chosen ? "text-emerald-600" : "text-stone-500"}>{c.chosen ? "✓ 골랐음" : "✕ 안 고름"} · {c.kind}</span>)}
              <div className="flex flex-wrap gap-2">
                <select className={small} value={c.kind} onChange={(e) => set({ kind: e.target.value as typeof c.kind })} aria-label="후보 종류">
                  {CANDIDATE_KINDS.map((k) => <option key={k}>{k}</option>)}
                </select>
                <input className={`${small} min-w-0 flex-1`} value={c.name} placeholder="후보 이름" onChange={(e) => set({ name: e.target.value })} aria-label="후보 이름" />
                <button type="button" onClick={() => set({ chosen: !c.chosen })}
                  className={`rounded-full px-3 py-1 text-xs font-bold ${c.chosen ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>{c.chosen ? "골랐음" : "안 고름"}</button>
                {removeBtn(() => setF((p) => ({ ...p, candidates: p.candidates.filter((y) => y.uid !== c.uid) })))}
              </div>
              <input className={`${small} mt-1 w-full`} value={c.reason} placeholder={c.chosen ? "고른 이유" : "안 고른 이유"} onChange={(e) => set({ reason: e.target.value })} aria-label="이유" />
            </>, c.chosen ? "bg-emerald-50/50" : "");
          })}
          {addBtn("후보 추가", () => setF((p) => ({ ...p, candidates: [...p.candidates, { uid: newUid(), kind: "장소", name: "", chosen: false, reason: "" }] })))}
          <div className="pt-1 text-xs font-bold text-stone-500">해보니 필요 없었던 과정</div>
          {f.skipped.length === 0 && emptySection("skips", "생략한 과정")}
          {f.skipped.map((x) => {
            const key = `skip:${x.uid}`;
            return box(key, <>{head(key, "생략한 과정")}
              <div className="flex gap-1">
                <input className={input} value={x.text} onChange={(e) => upd(key, (p) => ({ ...p, skipped: p.skipped.map((y) => (y.uid === x.uid ? { ...y, text: e.target.value } : y)) }))} />
                {removeBtn(() => setF((p) => ({ ...p, skipped: p.skipped.filter((y) => y.uid !== x.uid) })))}
              </div></>);
          })}
          {addBtn("생략한 과정 추가", () => setF((p) => ({ ...p, skipped: [...p.skipped, { uid: newUid(), text: "" }] })))}
        </div>
      )}

      {tab === "owner" && (
        <div className="space-y-2">
          <p className="text-[11px] text-stone-500">담당자는 이름 없이 “○○○○ 담당 교사”로만 남아요.</p>
          {([["owner.good", "good", "잘된 점"], ["owner.problem", "problem", "문제였던 점"], ["owner.nextYear", "nextYear", "내년엔"]] as const).map(([key, k, label]) =>
            box(key, <>{head(key, label)}
              <textarea className={`${input} h-14`} value={f.owner[k]} onChange={(e) => upd(key, (p) => ({ ...p, owner: { ...p.owner, [k]: e.target.value } }))} /></>))}
        </div>
      )}

      {tab === "career" && (
        <div className="space-y-2">
          {box("career.tracks", <>{head("career.tracks", "관련 계열")}
            <div className="flex flex-wrap gap-1">
              {CAREER_TRACKS.map((t) => {
                const on = f.career.tracks.includes(t);
                return (
                  <button key={t} type="button" aria-pressed={on}
                    onClick={() => upd("career.tracks", (p) => ({ ...p, career: { ...p.career, tracks: on ? p.career.tracks.filter((x) => x !== t) : [...p.career.tracks, t] } }))}
                    className={`rounded-full px-3 py-1 text-xs font-bold ${on ? "bg-sky-500 text-white" : "bg-stone-100 text-stone-500"}`}>{t}</button>
                );
              })}
            </div></>)}
          {([["career.subjects", "subjects", "연계 과목 (쉼표로 구분)"], ["career.creativeArea", "creativeArea", "창체 영역"], ["career.target", "target", "대상"]] as const).map(([key, k, label]) =>
            box(key, <>{head(key, label)}
              <input className={input} value={f.career[k]} onChange={(e) => upd(key, (p) => ({ ...p, career: { ...p.career, [k]: e.target.value } }))} /></>))}
        </div>
      )}

      <div className="sticky bottom-0 -mx-6 -mb-6 flex items-center justify-between gap-2 border-t border-stone-200 bg-cream px-6 py-3">
        {blocked
          ? <span role="status" className={`text-xs font-bold ${showWhy ? "text-red-600" : "text-amber-700"}`}>저장하려면: {blocked}</span>
          : <span className="text-[11px] text-stone-400">저장할 때 이름·전화번호는 한 번 더 가려요.</span>}
        <button type="button" onClick={trySave} aria-disabled={!!blocked}
          className={`shrink-0 rounded-full px-5 py-2 text-sm font-bold text-white ${blocked ? "bg-stone-400" : "bg-stone-800"}`}>내년 캘린더에 저장</button>
      </div>
    </div>
  );
}
