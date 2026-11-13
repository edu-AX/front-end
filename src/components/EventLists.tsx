"use client";
import { events, eventDate, dday, ddayLabel, progress, nextStep, mmdd, type Persist } from "@/lib/data";

function Column({ scope, s, onOpen }: { scope: "교내" | "교외"; s: Persist; onOpen: (id: string) => void }) {
  const inside = scope === "교내";
  const list = events.filter((e) => e.scope === scope).sort((a, b) => eventDate(a, s).localeCompare(eventDate(b, s)));
  return (
    <section className={`rounded-3xl p-5 shadow-sm ${inside ? "bg-emerald-50" : "bg-sky-50"}`}>
      <h3 className="mb-3 flex items-center gap-2 text-lg font-bold">
        <span className={`inline-block h-3 w-3 rounded-full ${inside ? "bg-emerald-400" : "bg-sky-400"}`} />
        {scope} 행사 <span className="text-sm font-normal text-stone-500">{list.length}건</span>
      </h3>
      <ul className="space-y-2.5">
        {list.map((e) => {
          const d = dday(eventDate(e, s));
          const ns = nextStep(e, s);
          const p = progress(e, s);
          return (
            <li key={e.id}>
              <button onClick={() => onOpen(e.id)} className="block w-full rounded-2xl bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{e.title}</div>
                    <div className="text-xs text-stone-500">{mmdd(eventDate(e, s))} · {e.participants}명</div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${d < 0 ? "bg-stone-200 text-stone-500" : inside ? "bg-emerald-400 text-white" : "bg-sky-400 text-white"}`}>{ddayLabel(d)}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100"><div className={`h-full rounded-full ${inside ? "bg-emerald-400" : "bg-sky-400"}`} style={{ width: `${p}%` }} /></div>
                <div className="mt-1.5 text-xs text-stone-500">{ns ? <>다음 단계: <b className="font-semibold text-stone-700">{ns.label}</b> ({mmdd(ns.due)})</> : "모든 단계 완료 🎉"}</div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function EventLists({ s, onOpen }: { s: Persist; onOpen: (id: string) => void }) {
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <Column scope="교내" s={s} onOpen={onOpen} />
      <Column scope="교외" s={s} onOpen={onOpen} />
    </div>
  );
}
