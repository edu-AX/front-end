"use client";
import { useState } from "react";
import { events, templates, eventDate, buildSteps, changes, dday, ddayLabel, diffDays, DEMO_TODAY, mmdd, type Persist } from "@/lib/data";
import { BudgetTab, CareerTab, OwnerTab, VenueTab } from "./EventTabs";

export type TabKey = "check" | "budget" | "venue" | "owner" | "career";
const TABS: { key: TabKey; label: string }[] = [
  { key: "check", label: "체크리스트" }, { key: "budget", label: "예산" }, { key: "venue", label: "장소" }, { key: "owner", label: "담당 이력" }, { key: "career", label: "진로·과목" },
];

export default function EventDrawer({ id, tab: initialTab, s, update, onClose }: {
  id: string; tab?: TabKey; s: Persist; update: (p: Partial<Persist> | ((s: Persist) => Partial<Persist>)) => void; onClose: () => void;
}) {
  const [tab, setTab] = useState<TabKey>(initialTab ?? "check");
  const ev = events.find((e) => e.id === id);
  if (!ev) return null;
  const date = eventDate(ev, s);
  const steps = buildSteps(ev, s);
  const alerts = ev.changeAlertIds.map((cid) => changes.find((c) => c.id === cid)).filter(Boolean) as typeof changes;
  const color = ev.scope === "교내" ? "bg-emerald-400" : "bg-sky-400";

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20" onClick={onClose}>
      <aside onClick={(e) => e.stopPropagation()} className="h-full w-full max-w-md overflow-y-auto bg-cream p-6 shadow-xl">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold text-white ${color}`}>{ev.scope} · {templates[ev.template].label}</span>
            {ev.careerTracks.map((t) => <span key={t} className="ml-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800">{t}</span>)}
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
            <div className="mb-4 rounded-2xl bg-white p-4 text-sm shadow-sm">
              <label className="flex items-center justify-between gap-2">
                <span className="text-stone-500">행사일</span>
                <input type="date" value={date} onChange={(e) => e.target.value && update((p) => ({ dates: { ...p.dates, [ev.id]: e.target.value } }))} className="rounded-lg border border-stone-200 px-2 py-1" />
              </label>
              <div className="mt-2 flex justify-between"><span className="text-stone-500">남은 기간</span><b>{ddayLabel(dday(date))}</b></div>
              <div className="mt-1 flex justify-between"><span className="text-stone-500">참가 인원</span><b>{ev.participants}명</b></div>
            </div>

            {alerts.map((c) => {
              const key = `${ev.id}:${c.id}`;
              const confirmed = !!s.confirmed[key];
              const pending = c.status === "추진 중";
              return (
                <div key={c.id} className={`mb-4 rounded-2xl border-2 p-4 text-sm ${pending ? "border-orange-300 bg-orange-50" : "border-amber-300 bg-amber-50"}`}>
                  <div className="mb-2 flex items-center gap-2 font-bold">⚠️ {c.title}
                    <span className={`rounded-full px-2 py-0.5 text-[11px] text-white ${pending ? "bg-orange-500" : "bg-amber-500"}`}>{c.status}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-white p-2"><div className="text-[11px] text-stone-400">작년/현행</div>{c.before}</div>
                    <div className="rounded-xl bg-white p-2"><div className="text-[11px] text-stone-400">{pending ? "개정안" : "올해"}</div>{c.after}</div>
                  </div>
                  {pending && <p className="mt-2 font-semibold text-orange-700">현행 기준은 그대로 적용돼요. 개정은 추진 중이며 확정이 아니에요.</p>}
                  <div className="mt-2 flex items-center justify-between text-xs text-stone-500">
                    <a href={c.url} target="_blank" rel="noreferrer" className="underline">{c.source}</a>
                    <button onClick={() => update((p) => ({ confirmed: { ...p.confirmed, [key]: !confirmed } }))}
                      className={`rounded-full px-3 py-1 font-bold ${confirmed ? "bg-stone-200 text-stone-600" : "bg-stone-800 text-white"}`}>{confirmed ? "확인함 ✓" : "확인함"}</button>
                  </div>
                </div>
              );
            })}

            {ev.officeRules && (
              <div className="mb-4 rounded-2xl bg-sky-50 p-4 text-sm">
                <div className="mb-1 font-bold">우리 교육청 기준 ({ev.officeRules.office})</div>
                <div>동의율: {ev.officeRules.consentRate}</div>
                <div>안전요원: {ev.officeRules.safetyStaff}</div>
                <div className="mt-1 text-xs text-stone-400">출처 {ev.officeRules.sourceId} · 2026 기준(데모용 값)</div>
              </div>
            )}

            <h3 className="mb-2 text-sm font-bold text-stone-500">단계별 체크리스트 (D-day 역산)</h3>
            <ul className="mb-4 space-y-1.5">
              {steps.map((st) => {
                const late = !st.done && diffDays(st.due, DEMO_TODAY) < 0 && st.id !== "run";
                const money = st.id === "settle" || st.id === "disclose";
                return (
                  <li key={st.key}>
                    <label className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm shadow-sm ${money ? "bg-amber-50" : "bg-white"}`}>
                      <input type="checkbox" checked={st.done} onChange={(e) => update((p) => ({ done: { ...p.done, [st.key]: e.target.checked } }))} className="h-4 w-4 accent-emerald-500" />
                      <span className={`flex-1 ${st.done ? "text-stone-400 line-through" : ""}`}>{money && "💰 "}{st.label}</span>
                      <span className={`text-xs ${late ? "font-bold text-red-500" : "text-stone-400"}`}>{late ? "마감 지남 " : ""}{mmdd(st.due)}</span>
                    </label>
                  </li>
                );
              })}
            </ul>

            <h3 className="mb-2 text-sm font-bold text-stone-500">전임자 메모</h3>
            <div className="mb-4 space-y-2">
              {ev.handoverNotes.length === 0 && <p className="text-sm text-stone-400">등록된 메모가 없어요.</p>}
              {ev.handoverNotes.map((n, i) => (
                <div key={i} className="rotate-[-0.5deg] rounded-md bg-yellow-200 p-3 text-sm shadow">
                  <div className="mb-1 text-[11px] text-yellow-800">{n.year}년 전임자</div>{n.note}
                </div>
              ))}
            </div>

            <h3 className="mb-2 text-sm font-bold text-stone-500">내년에 넘길 메모</h3>
            <textarea value={s.notes[ev.id] ?? ""} onChange={(e) => update((p) => ({ notes: { ...p.notes, [ev.id]: e.target.value } }))}
              placeholder="내년 담당자에게 남길 말을 적어 주세요 (브라우저에 저장돼요)" className="h-24 w-full rounded-2xl border border-stone-200 bg-white p-3 text-sm" />
          </>
        )}
      </aside>
    </div>
  );
}
