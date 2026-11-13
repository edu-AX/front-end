"use client";
import { events, eventDate, dday, ddayLabel, progress, buildSteps, activeChanges, diffDays, DEMO_TODAY, mmdd, type Persist } from "@/lib/data";

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-3xl bg-white p-5 shadow-sm"><h3 className="mb-3 text-sm font-bold text-stone-500">{title}</h3>{children}</section>
);

export default function Widgets({ s, onOpen }: { s: Persist; onOpen: (id: string) => void }) {
  const upcoming = events.map((e) => ({ e, d: dday(eventDate(e, s)) })).filter((x) => x.d >= 0).sort((a, b) => a.d - b.d).slice(0, 3);
  const due = events
    .flatMap((e) => buildSteps(e, s).filter((st) => !st.done && st.id !== "run" && diffDays(st.due, DEMO_TODAY) <= 7).map((st) => ({ e, st, d: diffDays(st.due, DEMO_TODAY) })))
    .sort((a, b) => a.d - b.d);
  const alertCount = events.reduce((n, e) => n + activeChanges(e, s).length, 0);

  return (
    <div className="space-y-4">
      <Card title="다가오는 행사">
        <ul className="space-y-2">
          {upcoming.map(({ e, d }) => (
            <li key={e.id}>
              <button onClick={() => onOpen(e.id)} className="flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-left hover:bg-stone-50">
                <span className="truncate text-sm">{e.title}</span>
                <span className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-xs font-bold text-white ${e.scope === "교내" ? "bg-emerald-400" : "bg-sky-400"}`}>{ddayLabel(d)}</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="변경 알림">
        <div className="flex items-center gap-2">
          <span className={`text-3xl font-bold ${alertCount ? "text-orange-500" : "text-stone-300"}`}>{alertCount}</span>
          <span className="text-sm text-stone-500">{alertCount ? "건 확인이 필요해요 (캘린더의 ⚠️)" : "확인할 알림이 없어요"}</span>
        </div>
      </Card>
      <Card title="이번 주 마감 단계">
        {due.length === 0 ? <p className="text-sm text-stone-400">이번 주 마감 단계가 없어요.</p> : (
          <ul className="space-y-1.5">
            {due.slice(0, 5).map(({ e, st, d }) => (
              <li key={st.key}>
                <button onClick={() => onOpen(e.id)} className="flex w-full items-start justify-between gap-2 rounded-xl px-2 py-1 text-left hover:bg-stone-50">
                  <span className="text-sm leading-snug"><b className="font-semibold">{e.title}</b><br /><span className="text-stone-500">{st.label}</span></span>
                  <span className={`shrink-0 text-xs font-bold ${d < 0 ? "text-red-500" : "text-stone-500"}`}>{d < 0 ? `마감 ${-d}일 지남` : mmdd(st.due)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="행사별 진행률">
        <ul className="space-y-2.5">
          {events.map((e) => {
            const p = progress(e, s);
            return (
              <li key={e.id}>
                <button onClick={() => onOpen(e.id)} className="block w-full text-left">
                  <div className="mb-1 flex justify-between text-xs"><span className="truncate">{e.title}</span><span className="text-stone-500">{p}%</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-stone-100"><div className={`h-full rounded-full ${e.scope === "교내" ? "bg-emerald-400" : "bg-sky-400"}`} style={{ width: `${p}%` }} /></div>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
