"use client";
import { useState } from "react";
import { diffDays, formatDDay } from "@/lib/dates";
import { byline, mmdd } from "@/lib/dates-view";
import { getChange, getGuideline, getTemplate } from "@/lib/data";
import { getExt, getRecord, settlementSteps } from "@/lib/ext";
import { handoverCoverage } from "@/lib/handover";
import { maskPersonalInfo } from "@/lib/masking";
import { computeSchedule, effectiveEventDate, eventLevelNotes, isChangeConfirmed } from "@/lib/schedule";
import { useApp } from "@/lib/state";
import { isCustomStepId, type AnyStepId, type ChangeAlert, type HandoverNote, type ScheduledStep } from "@/lib/types";
import { useEscape } from "@/lib/useEscape";
import { useLockBodyScroll } from "@/lib/useLockBodyScroll";
import { BudgetTab, CareerTab, OwnerTab, VenueTab } from "./EventTabs";

const PII_LABEL = { name: "이름", phone: "전화번호", studentId: "학번", rrn: "주민번호", email: "이메일" } as const;
const PII_ORDER = ["name", "phone", "studentId", "rrn", "email"] as const;

export type TabKey = "check" | "budget" | "venue" | "owner" | "career";
const TABS: { key: TabKey; label: string }[] = [
  { key: "check", label: "인수인계" }, { key: "budget", label: "예산" }, { key: "venue", label: "장소" }, { key: "owner", label: "담당 이력" }, { key: "career", label: "진로·과목" },
];

export default function EventDrawer({ id, tab: initialTab, onClose }: { id: string; tab?: TabKey; onClose: () => void }) {
  const { state, ext, today, events, changes, setStep, setEventDate, addNote, toggleConfirm, updateExt, addCustomStep, editStep, hideStep, unhideStep, removeCustomStep } = useApp();
  const [tab, setTab] = useState<TabKey>(initialTab ?? "check");
  const [memo, setMemo] = useState("");
  const [memoStep, setMemoStep] = useState<AnyStepId | "">("");
  // 체크리스트 직접 편집
  const [editing, setEditing] = useState<{ id: AnyStepId; label: string; offset: string } | null>(null);
  const [adding, setAdding] = useState<{ label: string; offset: string; date: string } | null>(null);
  useLockBodyScroll();
  useEscape(onClose);
  const ev = events.find((e) => e.id === id);
  if (!ev) return null;

  const date = effectiveEventDate(ev, state);
  const schedule = computeSchedule(ev, today, state, undefined, changes);
  const extra = settlementSteps(ev, state, ext);
  type Row = {
    key: string; label: string; dueDate: string; done: boolean; alert: boolean; money: boolean;
    stepId?: AnyStepId; offsetDays?: number; isCustom?: boolean; author?: string; stepMemo?: string; edited?: boolean;
    lastYear?: ScheduledStep["lastYear"]; notes: HandoverNote[]; toggle: (v: boolean) => void;
  };
  const rows: Row[] = [
    ...schedule.map((s): Row => ({
      key: s.id, label: s.label, dueDate: s.dueDate, done: s.state === "done", alert: s.alertIds.length > 0, money: false,
      stepId: s.id, offsetDays: s.offsetDays, isCustom: s.isCustom, author: s.author, stepMemo: s.memo, edited: s.edited,
      lastYear: s.lastYear, notes: s.notes, toggle: (v: boolean) => setStep(ev.id, s.id, v ? "done" : "todo"),
    })),
    ...extra.map((s): Row => ({ key: s.id as string, label: s.label, dueDate: s.dueDate, done: s.done, alert: false, money: true, notes: [], toggle: (v: boolean) => updateExt((p) => ({ extraDone: { ...p.extraDone, [s.key]: v } })) })),
  ].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  // 숨긴 단계 (다시 보이기용 이름)
  const hiddenIds = state.hiddenSteps?.[ev.id] ?? [];
  const allStepLabels = new Map<string, string>([
    ...getTemplate(ev.template).steps.map((s) => [s.id, s.label] as [string, string]),
    ...[...(ev.customSteps ?? []), ...(state.customSteps?.[ev.id] ?? [])].map((c) => [c.id, c.label] as [string, string]),
  ]);
  const record = getRecord(ev.id);
  const stop = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); };
  const dLabel = (n: number) => (n === 0 ? "D-day" : n < 0 ? `D${n}` : `D+${n}`);
  const saveEdit = () => {
    if (!editing) return;
    const off = Number(editing.offset);
    editStep(ev.id, editing.id, { label: editing.label, ...(Number.isFinite(off) && editing.offset.trim() !== "" ? { offsetDays: Math.round(off) } : {}) });
    setEditing(null);
  };
  const saveAdd = () => {
    if (!adding || !adding.label.trim()) return;
    // 날짜를 고르면 행사일과의 차이로, 아니면 입력한 D-n 으로
    const off = adding.date ? diffDays(date, adding.date) : -Number(adding.offset);
    if (!Number.isFinite(off)) return;
    addCustomStep(ev.id, { label: adding.label, offsetDays: off });
    setAdding(null);
  };

  // 이 행사에 걸린 변경 알림 (기본 + 기준 업데이트 확인에서 추가한 것). 단계가 정해진 건 그 단계 아래에 붙인다
  const alerts = changes.filter((c) => c.eventIds.includes(ev.id));
  const stepIds = new Set<string>(schedule.map((s) => s.id));
  const eventAlerts = alerts.filter((c) => !c.stepId || !stepIds.has(c.stepId));
  const stepAlerts = (stepId?: AnyStepId) => (stepId ? alerts.filter((c) => c.stepId === stepId) : []);
  const changeBox = (c: ChangeAlert, compact = false) => {
    const confirmed = isChangeConfirmed(c, state);
    const pending = c.status === "추진 중";
    const added = c.publishedAt !== undefined;
    return (
      <div key={c.id} className={`rounded-2xl border-2 ${compact ? "p-3 text-xs" : "mb-4 p-4 text-sm"} ${pending ? "border-orange-300 bg-orange-50" : "border-amber-300 bg-amber-50"}`}>
        <div className="mb-2 flex flex-wrap items-center gap-2 font-bold">⚠️ {c.title}
          <span className={`rounded-full px-2 py-0.5 text-[11px] text-white ${pending ? "bg-orange-500" : "bg-amber-500"}`}>{c.status}</span>
          {added && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] text-sky-800">기준 업데이트 확인에서 추가</span>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white p-2"><div className="text-[11px] text-stone-400">작년/현행</div>{c.before}</div>
          <div className="rounded-xl bg-white p-2"><div className="text-[11px] text-stone-400">{pending ? "개정안" : "올해"}</div>{c.after}</div>
        </div>
        {pending && <p className="mt-2 font-semibold text-orange-700">현행 기준은 그대로 적용돼요. 개정은 추진 중이며 확정이 아니에요.</p>}
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-stone-500">
          <span>{c.source}</span>
          <button onClick={() => toggleConfirm(c.id)} disabled={c.confirmed}
            className={`shrink-0 rounded-full px-3 py-1 font-bold ${confirmed ? "bg-stone-200 text-stone-600" : "bg-stone-800 text-white"}`}>{confirmed ? "확인함 ✓" : "확인함"}</button>
        </div>
      </div>
    );
  };
  // 단계에 붙은 메모는 체크리스트 줄 아래에서 보여주므로, 여기엔 행사 전체 메모만
  const notes = eventLevelNotes(ev, state);
  const ly = ev.lastYear;
  // 넘기기: 올해 담당자가 다음 담당자에게 단계별로 남긴 기록 비율
  const coverage = handoverCoverage(Number(today.slice(0, 4)), state, [ev])[0];
  // 메모 입력 중 개인정보 실시간 점검 (업로드와 같은 maskPersonalInfo 사용)
  const masked = memo.trim() ? maskPersonalInfo(memo) : null;
  const pii = masked && masked.maskCount > 0 ? masked : null;
  const piiSummary = pii?.hits
    .slice().sort((a, b) => PII_ORDER.indexOf(a.kind) - PII_ORDER.indexOf(b.kind))
    .map((h) => `${PII_LABEL[h.kind]} ${h.count}`).join(", ");
  const saveMemo = () => {
    const text = (pii ? pii.maskedText : memo).trim();
    if (!text) return;
    addNote(ev.id, text, memoStep || undefined);
    setMemo("");
  };
  const rules = ev.officeRules;
  const ruleSource = rules ? getGuideline(rules.sourceId) : undefined;
  const color = ev.scope === "교내" ? "bg-emerald-400" : "bg-sky-400";
  const careerTracks = getExt(ev.id).careerTracks;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20" onClick={onClose}>
      <aside onClick={(e) => e.stopPropagation()} className="h-full w-full max-w-md overflow-y-auto overscroll-contain bg-cream p-6 shadow-xl">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold text-white ${color}`}>{ev.scope} · {getTemplate(ev.template).name}</span>
            {careerTracks.map((t) => <span key={t} className="ml-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800">{t}</span>)}
            <h2 className="mt-2 text-xl font-bold">{ev.title}</h2>
          </div>
          <button onClick={onClose} className="rounded-full bg-white px-3 py-1 text-sm shadow-sm">닫기</button>
        </div>

        <div className="mb-4 flex gap-1 overflow-x-auto rounded-full bg-white p-1 shadow-sm">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${tab === t.key ? "bg-stone-800 text-white" : "text-stone-500 hover:bg-stone-100"}`}>{t.label}</button>
          ))}
        </div>

        {tab === "budget" && <BudgetTab ev={ev} />}
        {tab === "venue" && <VenueTab ev={ev} />}
        {tab === "owner" && <OwnerTab ev={ev} />}
        {tab === "career" && <CareerTab ev={ev} />}

        {tab === "check" && (
          <>
            {ly && (
              <div className="mb-4 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 text-sm">
                <div className="mb-1 text-xs font-bold text-amber-700">📖 작년({ly.year}) 이 행사는</div>
                <p className="leading-relaxed">{ly.summary}</p>
                <div className="mt-2 text-xs text-stone-500">
                  {ly.owner} · {mmdd(ly.eventDate)} 실시{ly.participants ? ` · ${ly.participants}명` : ""}
                  {ly.partners?.length ? ` · ${ly.partners.join(", ")}` : ""}
                </div>
              </div>
            )}

            <div className="mb-4 rounded-2xl bg-white p-4 text-sm shadow-sm">
              <label className="flex items-center justify-between gap-2">
                <span className="text-stone-500">행사일</span>
                <input type="date" value={date} onChange={(e) => e.target.value && setEventDate(ev.id, e.target.value)} className="rounded-lg border border-stone-200 px-2 py-1" />
              </label>
              <div className="mt-2 flex justify-between"><span className="text-stone-500">남은 기간</span><b>{formatDDay(diffDays(today, date))}</b></div>
              <div className="mt-1 flex justify-between"><span className="text-stone-500">참가 인원</span><b>{ev.participants ?? "-"}명</b></div>
            </div>

            {eventAlerts.map((c) => changeBox(c))}

            {rules && (
              <div className="mb-4 rounded-2xl bg-sky-50 p-4 text-sm">
                <div className="mb-1 font-bold">우리 교육청 기준 ({rules.office})</div>
                {rules.consentRate && <div>동의율: {rules.consentRate}</div>}
                {rules.safetyStaff && <div>안전요원: {rules.safetyStaff}</div>}
                <div className="mt-1 text-xs text-stone-400">출처 {rules.sourceId}{ruleSource ? ` · ${ruleSource.year} 기준` : ""}{ruleSource?.needsVerification ? " · 원문 확인 필요(데모용 값)" : ""}</div>
              </div>
            )}

            <h3 className="mb-1 text-sm font-bold text-stone-500">단계별 인수인계 (D-day 역산)</h3>
            <p className="mb-2 text-[11px] text-stone-400">단계마다 작년 실제 기록과 전임자 메모가 붙어 있어요. ⚠ 는 작년에 문제가 있었던 단계예요.</p>
            <ul className="mb-4 space-y-2">
              {rows.map((r) => {
                const late = !r.done && diffDays(today, r.dueDate) < 0;
                const issue = r.lastYear?.hadIssue;
                return (
                  <li key={r.key} className={`group rounded-xl shadow-sm ${r.money ? "bg-amber-50" : r.isCustom ? "bg-sky-50" : "bg-white"} ${issue ? "ring-1 ring-red-200" : ""}`}>
                    {editing && r.stepId && editing.id === r.stepId ? (
                      <form className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm" onSubmit={(e) => { e.preventDefault(); saveEdit(); }}>
                        <input autoFocus value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} maxLength={60} aria-label="단계 이름"
                          className="min-w-0 flex-1 rounded-full border border-stone-200 bg-white px-3 py-1 text-sm" />
                        <label className="flex items-center gap-1 text-xs text-stone-500">행사일 기준
                          <input type="number" value={editing.offset} onChange={(e) => setEditing({ ...editing, offset: e.target.value })} aria-label="행사일 기준 일수"
                            className="w-16 rounded-full border border-stone-200 bg-white px-2 py-1 text-xs" />일
                          {editing.offset.trim() !== "" && Number.isFinite(Number(editing.offset)) && <b className="text-stone-600">({dLabel(Math.round(Number(editing.offset)))})</b>}
                        </label>
                        <button className="rounded-full bg-amber-400 px-3 py-1 text-xs font-bold">저장</button>
                        <button type="button" onClick={() => setEditing(null)} className="rounded-full bg-stone-100 px-3 py-1 text-xs">취소</button>
                      </form>
                    ) : (
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                        <input type="checkbox" checked={r.done} onChange={(e) => r.toggle(e.target.checked)} className="h-4 w-4 accent-emerald-500" />
                        <span className={`flex-1 ${r.done ? "text-stone-400 line-through" : ""}`}>
                          {r.money && "💰 "}{r.alert && "⚠️ "}{r.label}
                          {r.isCustom && <span className="ml-1.5 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">추가함{r.author ? ` · ${r.author}` : ""}</span>}
                          {r.edited && <span className="ml-1.5 rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500">수정됨</span>}
                        </span>
                        {r.stepId && (
                          <span className="flex shrink-0 gap-0.5 opacity-60 transition group-hover:opacity-100">
                            <button type="button" title="이름·마감 고치기" aria-label="단계 고치기" className="rounded px-1 hover:bg-stone-100"
                              onClick={(e) => { stop(e); setEditing({ id: r.stepId!, label: r.label, offset: String(r.offsetDays ?? 0) }); }}>✏️</button>
                            {r.isCustom ? (
                              <button type="button" title="이 단계 지우기" aria-label="단계 지우기" className="rounded px-1 hover:bg-stone-100"
                                onClick={(e) => { stop(e); if (isCustomStepId(r.stepId!)) removeCustomStep(ev.id, r.stepId); }}>🗑</button>
                            ) : (
                              <button type="button" title="우리 학교에선 안 하는 단계 숨기기" aria-label="단계 숨기기" className="rounded px-1 hover:bg-stone-100"
                                onClick={(e) => { stop(e); hideStep(ev.id, r.stepId!); }}>🙈</button>
                            )}
                          </span>
                        )}
                        <span className={`text-xs ${late ? "font-bold text-red-500" : "text-stone-400"}`}>{late ? "마감 지남 " : ""}{mmdd(r.dueDate)}</span>
                      </label>
                    )}
                    {r.stepMemo && <div className="px-3 pb-2 pl-10 text-xs leading-snug text-sky-800">📝 {r.stepMemo}</div>}
                    {(r.lastYear || r.notes.length > 0) && (
                      <div className="space-y-1 px-3 pb-2 pl-10">
                        {r.lastYear && (
                          <div className={`text-xs leading-snug ${issue ? "text-red-600" : "text-stone-500"}`}>
                            {issue && "⚠ "}작년엔 {r.lastYear.actualDate ? `${mmdd(r.lastYear.actualDate)}에 함` : "날짜 기록 없음"}
                            {r.lastYear.memo && ` — ${r.lastYear.memo}`}
                            {r.lastYear.lateByDays !== null && r.lastYear.lateByDays > 0 && <span className="ml-1 font-bold text-orange-600">권장보다 {r.lastYear.lateByDays}일 늦었음</span>}
                          </div>
                        )}
                        {r.notes.map((n, i) => (
                          <div key={i} className="rotate-[-0.3deg] rounded-md bg-yellow-200 px-2 py-1 text-xs leading-snug shadow-sm">
                            💬 {n.note} <span className="text-yellow-800">— {byline(n.year, n.author)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {stepAlerts(r.stepId).length > 0 && (
                      <div className="space-y-2 px-3 pb-3 pl-10">{stepAlerts(r.stepId).map((c) => changeBox(c, true))}</div>
                    )}
                  </li>
                );
              })}
            </ul>

            {/* 체크리스트 직접 편집: 단계 추가 · 숨긴 단계 다시 보이기 */}
            <div className="mb-5 space-y-2">
              {adding ? (
                <form className="space-y-2 rounded-xl bg-white p-3 text-sm shadow-sm" onSubmit={(e) => { e.preventDefault(); saveAdd(); }}>
                  <div className="text-xs font-bold text-stone-500">우리 학교에만 있는 단계 추가</div>
                  <input autoFocus value={adding.label} onChange={(e) => setAdding({ ...adding, label: e.target.value })} maxLength={60}
                    placeholder="예: 박람회 단체 사전등록" className="w-full rounded-full border border-stone-200 px-3 py-1.5 text-sm" />
                  <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                    <label className="flex items-center gap-1">행사
                      <input type="number" min={0} value={adding.offset} onChange={(e) => setAdding({ ...adding, offset: e.target.value, date: "" })}
                        className="w-16 rounded-full border border-stone-200 px-2 py-1" aria-label="행사 며칠 전" />일 전
                    </label>
                    <span>또는</span>
                    <input type="date" value={adding.date} onChange={(e) => setAdding({ ...adding, date: e.target.value })} aria-label="마감 날짜"
                      className="rounded-full border border-stone-200 px-2 py-1" />
                  </div>
                  <div className="flex gap-2">
                    <button disabled={!adding.label.trim()} className="rounded-full bg-amber-400 px-4 py-1.5 text-xs font-bold disabled:opacity-40">추가</button>
                    <button type="button" onClick={() => setAdding(null)} className="rounded-full bg-stone-100 px-4 py-1.5 text-xs">취소</button>
                  </div>
                  <p className="text-[11px] text-stone-400">추가한 단계는 진행률·캘린더·이번 주 마감에 바로 들어가요.</p>
                </form>
              ) : (
                <button type="button" onClick={() => setAdding({ label: "", offset: "14", date: "" })}
                  className="w-full rounded-xl border border-dashed border-stone-300 py-2 text-sm text-stone-500 hover:bg-white">+ 단계 추가</button>
              )}
              {hiddenIds.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-400">
                  숨긴 단계:
                  {hiddenIds.map((h) => (
                    <button key={h} type="button" onClick={() => unhideStep(ev.id, h as AnyStepId)} title="다시 보이기"
                      className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-500 hover:bg-stone-200">{allStepLabels.get(h) ?? h} ↺</button>
                  ))}
                </div>
              )}
            </div>

            {record && (
              <section className="mb-5">
                <h3 className="mb-1 text-sm font-bold text-stone-500">전임자의 고민 기록</h3>
                <p className="mb-2 text-[11px] text-stone-400">무엇을 골랐는지보다 왜 다른 걸 안 골랐는지가 내년에 더 쓸모 있어요.</p>
                {record.candidates.length > 0 && (
                  <ul className="mb-2 space-y-1.5">
                    {record.candidates.map((c, i) => (
                      <li key={i} className={`rounded-xl px-3 py-2 text-sm shadow-sm ${c.chosen ? "bg-emerald-50" : "bg-white"}`}>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${c.chosen ? "text-emerald-600" : "text-stone-400"}`}>{c.chosen ? "✓ 골랐음" : "✕ 안 고름"}</span>
                          <span className="rounded-full bg-stone-100 px-1.5 text-[10px] text-stone-500">{c.kind}</span>
                          <span className="font-medium">{c.name}</span>
                        </div>
                        {c.reason && <div className={`mt-0.5 text-xs ${c.chosen ? "text-emerald-700" : "text-stone-500"}`}>{c.chosen ? "이유: " : "안 고른 이유: "}{c.reason}</div>}
                      </li>
                    ))}
                  </ul>
                )}
                {record.skipped.length > 0 && (
                  <div className="rounded-xl bg-white px-3 py-2 text-xs shadow-sm">
                    <div className="mb-1 font-bold text-stone-500">일부러 생략한 것</div>
                    <ul className="list-disc space-y-0.5 pl-4 text-stone-600">{record.skipped.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </div>
                )}
              </section>
            )}

            <h3 className="mb-2 text-sm font-bold text-stone-500">행사 전체 메모</h3>
            <div className="mb-3 space-y-2">
              {notes.length === 0 && <p className="text-sm text-stone-400">단계에 묶이지 않은 메모가 없어요.</p>}
              {notes.map((n, i) => (
                <div key={i} className="rotate-[-0.5deg] rounded-md bg-yellow-200 p-3 text-sm shadow">
                  <div className="mb-1 text-[11px] text-yellow-800">{byline(n.year, n.author)}</div>{n.note}
                </div>
              ))}
            </div>
            <form className="mb-4 space-y-2" onSubmit={(e) => { e.preventDefault(); saveMemo(); }}>
              <div className="text-xs font-bold text-stone-500">다음 담당자에게 남기기</div>
              {coverage && (
                <div className="rounded-xl bg-white px-3 py-2 text-xs shadow-sm">
                  <div className="flex justify-between"><span>다음 담당자에게 남긴 기록</span><b>{coverage.percent}%</b></div>
                  <div className="my-1 h-1.5 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${coverage.percent}%` }} /></div>
                  {coverage.missingSteps.length > 0 && <div className="text-stone-400">비어 있는 단계: {coverage.missingSteps.map((m) => m.label.split(",")[0]).join(", ")}</div>}
                </div>
              )}
              <select value={memoStep} onChange={(e) => setMemoStep(e.target.value as AnyStepId | "")} className="w-full rounded-full border border-stone-200 bg-white px-4 py-2 text-sm">
                <option value="">행사 전체</option>
                {schedule.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <div className="flex gap-2">
                <input value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={300} placeholder="메모 추가 (학생 이름·연락처는 적지 마세요)"
                  className={`min-w-0 flex-1 rounded-full border bg-white px-4 py-2 text-sm ${pii ? "border-red-400" : "border-stone-200"}`} />
                <button className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${pii ? "bg-red-500 text-white" : "bg-amber-400"}`}>{pii ? "가려서 저장" : "추가"}</button>
              </div>
              {pii && (
                <div className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">
                  <b>이름·전화번호로 보이는 내용이 있어요 ({piiSummary})</b>
                  <div className="mt-0.5 text-red-500">저장되는 내용: {pii.maskedText}</div>
                </div>
              )}
            </form>

            {(ev.updatedBy || ev.updatedAt) && <p className="text-xs text-stone-400">마지막 수정: {ev.updatedBy ?? "-"} · {ev.updatedAt ?? "-"}</p>}
          </>
        )}
      </aside>
    </div>
  );
}
