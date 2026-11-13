"use client";
import { useMemo } from "react";
import { buildCalendar } from "@/lib/dashboard";
import { parse } from "@/lib/dates-view";
import { settlementSteps } from "@/lib/ext";
import { useApp } from "@/lib/state";
import type { CalendarItem, EventCard } from "@/lib/types";

const pad = (n: number) => String(n).padStart(2, "0");

type Chip = { eventId: string; kind: "event" | "deadline"; label: string; full?: string; color: "green" | "blue"; hasAlert: boolean; done: boolean };

export default function Calendar({ year, month, onMonth, onOpen, evs }: {
  year: number; month: number; onMonth: (y: number, m: number) => void; onOpen: (id: string) => void; evs: EventCard[];
}) {
  const { state, ext, today, changes } = useApp();

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(year, month - 1, 1));
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const arr: (string | null)[] = Array(first.getUTCDay()).fill(null);
    for (let d = 1; d <= days; d++) arr.push(`${year}-${pad(month)}-${pad(d)}`);
    while (arr.length % 7) arr.push(null);
    return arr;
  }, [year, month]);

  const items = useMemo(() => {
    const map: Record<string, Chip[]> = {};
    const ym = `${year}-${pad(month)}`;
    const push = (date: string, c: Chip) => (map[date] ||= []).push(c);
    buildCalendar(ym, today, state, evs, changes).forEach((i: CalendarItem) =>
      push(i.date, { eventId: i.eventId, kind: i.kind, full: i.label, label: i.kind === "deadline" ? i.label.split(" · ").slice(1).join(" · ") : i.label, color: i.color, hasAlert: i.hasAlert, done: !!i.done }));
    // 정산 마감·학부모 공개(확장 단계)
    for (const e of evs) for (const st of settlementSteps(e, state, ext))
      if (st.dueDate.startsWith(`${ym}-`)) push(st.dueDate, { eventId: e.id, kind: "deadline", label: `💰 ${st.label}`, color: e.scope === "교내" ? "green" : "blue", hasAlert: false, done: st.done });
    return map;
  }, [year, month, today, state, ext, evs, changes]);

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
            {d && <div className={`mb-0.5 text-[11px] ${d === today ? "font-bold text-red-500" : "text-stone-500"}`}>{parse(d).getUTCDate()}{d === today ? " · 오늘" : ""}</div>}
            {d && (items[d] ?? []).slice(0, 3).map((it, j) => (
              <button key={j} onClick={() => onOpen(it.eventId)} title={it.full ?? it.label}
                className={`mb-0.5 block w-full truncate rounded-md px-1 py-0.5 text-left text-[11px] leading-tight ${
                  it.kind === "event"
                    ? it.color === "green" ? "bg-emerald-400 font-semibold text-white" : "bg-sky-400 font-semibold text-white"
                    : `${it.color === "green" ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800"} ${it.done ? "line-through opacity-50" : ""}`}`}>
                {it.hasAlert ? "⚠️ " : ""}{it.label}
              </button>
            ))}
            {d && (items[d]?.length ?? 0) > 3 && <div className="text-[10px] text-stone-400">+{items[d].length - 3}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}
