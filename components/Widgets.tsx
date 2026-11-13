"use client";
import { buildDashboard } from "@/lib/dashboard";
import { diffDays, formatDDay } from "@/lib/dates";
import { mmdd } from "@/lib/dates-view";
import { budgets, getExt, settlementSteps, studentCounts, tracks, won } from "@/lib/ext";
import { useApp } from "@/lib/state";
import type { EventCard } from "@/lib/types";

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-3xl bg-white p-5 shadow-sm"><h3 className="mb-3 text-sm font-bold text-stone-500">{title}</h3>{children}</section>
);

export function CareerDistribution({ track, onTrack }: { track: string; onTrack: (t: string) => void }) {
  const { events } = useApp();
  const counts = tracks.map((t) => ({ t, n: events.filter((e) => getExt(e.id).careerTracks.includes(t)).length, students: studentCounts["2"]?.[t] ?? 0 }));
  const max = Math.max(1, ...counts.map((c) => c.n));
  const common = events.filter((e) => getExt(e.id).careerTracks.length === 0).length;
  const ratio = (c: { n: number; students: number }) => (c.students ? (c.n / c.students) * 100 : Infinity);
  const lowest = counts.reduce((a, b) => (ratio(b) < ratio(a) ? b : a)).t;
  return (
    <Card title="계열별 행사 분포 (1년)">
      <ul className="space-y-2">
        {counts.map((c) => (
          <li key={c.t}>
            <button onClick={() => onTrack(track === c.t ? "전체" : c.t)} className={`block w-full rounded-lg px-1 py-0.5 text-left ${track === c.t ? "bg-violet-50" : "hover:bg-stone-50"}`}>
              <div className="flex justify-between text-xs">
                <span className="font-semibold">{c.t}{c.t === lowest && <span className="ml-1 rounded-full bg-orange-100 px-1.5 text-[10px] text-orange-700">행사 부족</span>}</span>
                <span className="text-stone-500">행사 {c.n}건 · 2학년 {c.students}명</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-violet-400" style={{ width: `${(c.n / max) * 100}%` }} /></div>
              <div className="mt-0.5 text-[10px] text-stone-400">학생 100명당 {((c.n / c.students) * 100).toFixed(1)}건</div>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-stone-400">전 학년 공통 행사 {common}건은 모든 계열에 해당해 제외했어요. 학생 수는 가상 집계값이에요.</p>
    </Card>
  );
}

export function ProgressList({ onOpen, evs }: { onOpen: (id: string) => void; evs: EventCard[] }) {
  const { state, today } = useApp();
  const d = buildDashboard(today, state, evs);
  return (
    <Card title="행사별 진행률">
      <ul className="space-y-2.5">
        {d.progress.map((p) => {
          const e = evs.find((x) => x.id === p.eventId)!;
          return (
            <li key={p.eventId}>
              <button onClick={() => onOpen(p.eventId)} className="block w-full text-left">
                <div className="mb-1 flex justify-between text-xs"><span className="truncate">{p.title}</span><span className="text-stone-500">{p.percent}%</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-stone-100"><div className={`h-full rounded-full ${e.scope === "교내" ? "bg-emerald-400" : "bg-sky-400"}`} style={{ width: `${p.percent}%` }} /></div>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export default function Widgets({ onOpen, evs }: { onOpen: (id: string) => void; evs: EventCard[] }) {
  const { state, ext, today, events } = useApp();
  const d = buildDashboard(today, state, evs);

  const planned = budgets.reduce((n, b) => n + b.sources.reduce((a, x) => a + x.planned, 0), 0);
  const spent = budgets.reduce((n, b) => n + b.sources.reduce((a, x) => a + x.spent, 0), 0);
  const byType: Record<string, { planned: number; spent: number; transferable: boolean }> = {};
  for (const b of budgets) for (const x of b.sources) {
    const t = (byType[x.type] ||= { planned: 0, spent: 0, transferable: x.transferable });
    t.planned += x.planned; t.spent += x.spent;
  }
  const settles = events
    .map((e) => ({ e, st: settlementSteps(e, state, ext).find((s) => s.id === "settle") }))
    .filter((x) => x.st && !x.st.done)
    .sort((a, b) => a.st!.dueDate.localeCompare(b.st!.dueDate));

  return (
    <div className="space-y-4">
      <Card title="다가오는 행사">
        <ul className="space-y-2">
          {d.upcoming.length === 0 && <li className="text-sm text-stone-400">조건에 맞는 행사가 없어요.</li>}
          {d.upcoming.slice(0, 3).map((u) => (
            <li key={u.eventId}>
              <button onClick={() => onOpen(u.eventId)} className="block w-full rounded-xl px-2 py-1.5 text-left hover:bg-stone-50">
                <div className="flex items-center justify-between">
                  <span className="truncate text-sm font-semibold">{u.title}</span>
                  <span className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-xs font-bold text-white ${u.scope === "교내" ? "bg-emerald-400" : "bg-sky-400"}`}>{formatDDay(u.dDay)}</span>
                </div>
                {u.nextStep && <div className="mt-0.5 text-xs text-stone-500">다음 단계: {u.nextStep.label}</div>}
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="변경 알림">
        <div className="flex items-center gap-2">
          <span className={`text-3xl font-bold ${d.unconfirmedAlertCount ? "text-orange-500" : "text-stone-300"}`}>{d.unconfirmedAlertCount}</span>
          <span className="text-sm text-stone-500">{d.unconfirmedAlertCount ? "건 확인이 필요해요 (캘린더의 ⚠️)" : "확인할 알림이 없어요"}</span>
        </div>
      </Card>
      <Card title="마감 단계">
        {d.overdue.length === 0 && d.thisWeek.length === 0 ? <p className="text-sm text-stone-400">이번 주 마감 단계가 없어요.</p> : (
          <ul className="space-y-1.5">
            {d.overdue.slice(0, 3).map((s) => (
              <li key={`o-${s.eventId}-${s.id}`}>
                <button onClick={() => onOpen(s.eventId)} className="flex w-full items-start justify-between gap-2 rounded-xl bg-red-50 px-2 py-1 text-left hover:bg-red-100">
                  <span className="text-sm leading-snug"><b className="font-semibold">{s.eventTitle}</b><br /><span className="text-stone-500">{s.label}</span></span>
                  <span className="shrink-0 text-xs font-bold text-red-500">마감 {-s.daysLeft}일 지남</span>
                </button>
              </li>
            ))}
            {d.thisWeek.slice(0, 4).map((s) => (
              <li key={`w-${s.eventId}-${s.id}`}>
                <button onClick={() => onOpen(s.eventId)} className="flex w-full items-start justify-between gap-2 rounded-xl px-2 py-1 text-left hover:bg-stone-50">
                  <span className="text-sm leading-snug"><b className="font-semibold">{s.eventTitle}</b><br /><span className="text-stone-500">{s.label}</span></span>
                  <span className="shrink-0 text-xs font-bold text-stone-500">이번 주 {mmdd(s.dueDate)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="예산 (부서 전체)">
        <div className="mb-1 flex justify-between text-xs"><span>집행 {won(spent)} / 편성 {won(planned)}</span><b>{Math.round((spent / planned) * 100)}%</b></div>
        <div className="mb-3 h-2.5 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-amber-400" style={{ width: `${(spent / planned) * 100}%` }} /></div>
        <div className="mb-3 space-y-1 text-xs">
          {Object.entries(byType).map(([type, v]) => (
            <div key={type} className="flex items-center justify-between">
              <span>{type} 잔액 {!v.transferable && <span className="ml-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">이·전용 불가</span>}</span>
              <b>{won(v.planned - v.spent)}</b>
            </div>
          ))}
        </div>
        <div className="text-xs font-bold text-stone-500">정산 마감 예정</div>
        <ul className="mt-1 space-y-1">
          {settles.map(({ e, st }) => (
            <li key={e.id}>
              <button onClick={() => onOpen(e.id)} className="flex w-full justify-between rounded-lg px-1 py-0.5 text-left text-xs hover:bg-stone-50">
                <span className="truncate">{e.title}</span><span className="ml-2 shrink-0 text-stone-500">{mmdd(st!.dueDate)} ({formatDDay(diffDays(today, st!.dueDate))})</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-stone-400">인수인계용 요약이며 실제 집행은 학교회계 시스템에서 해요. 가상 데이터예요.</p>
      </Card>
    </div>
  );
}
