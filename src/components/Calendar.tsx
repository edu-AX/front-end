"use client";
import { useMemo } from "react";
import { events, eventDate, buildSteps, activeChanges, parse, type Persist } from "@/lib/data";

const pad = (n: number) => String(n).padStart(2, "0");

type Item = { id: string; kind: "event" | "step"; label: string; scope: string; warn: boolean };

export default function Calendar({ year, month, onMonth, s, onOpen }: {
  year: number; month: number; onMonth: (y: number, m: number) => void; s: Persist; onOpen: (id: string) => void;
}) {
  const cells = useMemo(() => {
    const first = new Date(Date.UTC(year, month - 1, 1));
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const arr: (string | null)[] = Array(first.getUTCDay()).fill(null);
    for (let d = 1; d <= days; d++) arr.push(`${year}-${pad(month)}-${pad(d)}`);
    while (arr.length % 7) arr.push(null);
    return arr;
  }, [year, month]);

  const items = useMemo(() => {
    const map: Record<string, Item[]> = {};
    for (const ev of events) {
      const warn = activeChanges(ev, s).length > 0;
      (map[eventDate(ev, s)] ||= []).push({ id: ev.id, kind: "event", label: ev.title, scope: ev.scope, warn });
      for (const st of buildSteps(ev, s)) {
        if (st.id === "run" || st.done) continue;
        (map[st.due] ||= []).push({ id: ev.id, kind: "step", label: st.label.split("·")[0].split("/")[0].trim(), scope: ev.scope, warn: false });
      }
    }
    return map;
  }, [s]);

  const move = (n: number) => {
    const d = new Date(Date.UTC(year, month - 1 + n, 1));
    onMonth(d.getUTCFullYear(), d.getUTCMonth() + 1);
  };

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">{year}년 {month}월</h2>
        <div className="flex gap-2 text-sm">
          <button onClick={() => move(-1)} className="rounded-full bg-stone-100 px-3 py-1 hover:bg-stone-200">◀</button>
          <button onClick={() => move(1)} className="rounded-full bg-stone-100 px-3 py-1 hover:bg-stone-200">▶</button>
        </div>
      </div>
      <div className="mb-2 flex gap-3 text-xs text-stone-500">
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" />교내</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-sky-400" />교외</span>
        <span>연한 칩 = 단계 마감일</span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-stone-500">
        {["일", "월", "화", "수", "목", "금", "토"].map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => (
          <div key={i} className={`min-h-[84px] rounded-xl p-1 ${d ? "bg-stone-50" : ""}`}>
            {d && <div className="mb-0.5 text-[11px] text-stone-500">{parse(d).getUTCDate()}</div>}
            {d && (items[d] ?? []).slice(0, 3).map((it, j) => (
              <button key={j} onClick={() => onOpen(it.id)} title={it.label}
                className={`mb-0.5 block w-full truncate rounded-md px-1 py-0.5 text-left text-[11px] leading-tight ${
                  it.kind === "event"
                    ? it.scope === "교내" ? "bg-emerald-400 font-semibold text-white" : "bg-sky-400 font-semibold text-white"
                    : it.scope === "교내" ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800"}`}>
                {it.warn ? "⚠️ " : ""}{it.label}
              </button>
            ))}
            {d && (items[d]?.length ?? 0) > 3 && <div className="text-[10px] text-stone-400">+{items[d].length - 3}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}
