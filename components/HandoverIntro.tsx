"use client";
// 첫 방문 "인수인계 받기" 화면: 전임자 핵심 주의점 → 달라진 기준 → 올해 행사 한눈에 → 인수 확인
import { formatDDay } from "@/lib/dates";
import { mmdd } from "@/lib/dates-view";
import { acceptHandover, acknowledgeNote, buildHandoverBrief } from "@/lib/handover";
import { useApp } from "@/lib/state";

/** "2026 담당 교사"처럼 작성자에 이미 연도가 있으면 연도를 또 붙이지 않는다 */
export const byline = (year: number, author?: string) =>
  author?.includes(String(year)) ? author : `${year} ${author ?? "전임자"}`;

export default function HandoverIntro({ onDone, onOpen }: { onDone: () => void; onOpen: (id: string) => void }) {
  const { state, today, events, update, toggleConfirm } = useApp();
  const b = buildHandoverBrief(today, state, events);
  const from = b.from.length ? b.from.join(", ") : "전임자";
  const keyAcked = b.keyPoints.filter((p) => p.acknowledged).length;
  const pct = b.keyPoints.length ? Math.round((keyAcked / b.keyPoints.length) * 100) : 100;

  const accept = () => {
    if (!b.accepted) update((s) => acceptHandover(s, today));
    onDone();
  };
  const open = (id: string) => { onDone(); onOpen(id); };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-cream">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 text-center">
          <div className="text-4xl">📖</div>
          <h1 className="mt-2 text-2xl font-bold">{from}에게서 인수인계를 받아요</h1>
          <p className="mt-1 text-sm text-stone-500">창의적 체험활동부 · 작년 담당자의 기록과 올해 기준을 이어서 보여드려요.</p>
          {b.accepted && <p className="mt-2 inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">{b.acceptedAt} 인수 완료 · 다시 보는 중</p>}
        </div>

        <section className="mb-6 rounded-3xl bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-lg font-bold">① 전임자가 꼭 알려준 주의점</h2>
            <span className="text-xs text-stone-500">{keyAcked} / {b.keyPoints.length} 확인</span>
          </div>
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} /></div>
          <ul className="space-y-2">
            {b.keyPoints.map((p) => (
              <li key={p.key} className={`rounded-2xl p-3 text-sm transition ${p.acknowledged ? "bg-stone-50 text-stone-400" : "rotate-[-0.3deg] bg-yellow-100 shadow-sm"}`}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <button onClick={() => open(p.eventId)} className="truncate text-left text-xs font-bold text-amber-800 hover:underline">
                    {p.eventTitle}{p.stepLabel ? ` › ${p.stepLabel}` : ""}
                  </button>
                  <button onClick={() => update((s) => acknowledgeNote(s, p.key, !p.acknowledged))}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${p.acknowledged ? "bg-stone-200 text-stone-600" : "bg-stone-800 text-white"}`}>
                    {p.acknowledged ? "확인함 ✓" : "확인"}
                  </button>
                </div>
                <p className="leading-relaxed">💬 {p.note}</p>
                <div className="mt-1 text-[11px] text-stone-400">{byline(p.year, p.author)}</div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-6 rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-bold">② 작년과 달라진 기준</h2>
          <ul className="space-y-2">
            {b.changes.map((c) => {
              const pending = c.status === "추진 중";
              return (
                <li key={c.id} className={`rounded-2xl border-2 p-3 text-sm ${pending ? "border-orange-300 bg-orange-50" : "border-amber-300 bg-amber-50"}`}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-bold">⚠️ {c.title} <span className={`ml-1 rounded-full px-2 py-0.5 text-[11px] text-white ${pending ? "bg-orange-500" : "bg-amber-500"}`}>{c.status}</span></span>
                    <button onClick={() => toggleConfirm(c.id)} className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${c.confirmed ? "bg-stone-200 text-stone-600" : "bg-stone-800 text-white"}`}>{c.confirmed ? "확인함 ✓" : "확인"}</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-white p-2"><div className="text-[11px] text-stone-400">작년/현행</div>{c.before}</div>
                    <div className="rounded-xl bg-white p-2"><div className="text-[11px] text-stone-400">{pending ? "개정안" : "올해"}</div>{c.after}</div>
                  </div>
                  {pending && <p className="mt-2 text-xs font-semibold text-orange-700">현행 기준은 그대로 적용돼요. 개정은 추진 중이며 확정이 아니에요.</p>}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mb-8 rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-bold">③ 올해 행사 한눈에 — 작년엔 이랬어요</h2>
          <ul className="divide-y divide-stone-100">
            {b.events.map((e) => (
              <li key={e.eventId}>
                <button onClick={() => open(e.eventId)} className="block w-full py-3 text-left hover:bg-stone-50">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">
                      <span className={`mr-2 inline-block h-2 w-2 rounded-full ${e.scope === "교내" ? "bg-emerald-400" : "bg-sky-400"}`} />{e.title}
                    </span>
                    <span className="shrink-0 text-xs text-stone-500">올해 {mmdd(e.eventDate)} <b className="ml-1 text-stone-700">{formatDDay(e.dDay)}</b></span>
                  </div>
                  {e.lastYearSummary ? (
                    <p className="mt-1 text-xs leading-relaxed text-stone-500">
                      작년 {e.lastYearDate ? mmdd(e.lastYearDate) : ""} · {e.lastYearSummary}
                      {e.issueCount > 0 && <span className="ml-1 rounded bg-red-100 px-1 text-[10px] font-bold text-red-600">문제 단계 {e.issueCount}</span>}
                    </p>
                  ) : <p className="mt-1 text-xs text-stone-400">작년 기록이 없어요 (올해가 첫 해)</p>}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <div className="sticky bottom-4 flex flex-col items-center gap-2">
          <button onClick={accept} className="rounded-full bg-stone-800 px-8 py-3 text-base font-bold text-white shadow-lg hover:bg-stone-700">
            {b.accepted ? "대시보드로 돌아가기" : "인수인계 받았어요 →"}
          </button>
          {!b.accepted && keyAcked < b.keyPoints.length && <span className="rounded-full bg-white/80 px-3 py-1 text-xs text-stone-500">주의점은 나중에 행사 카드에서도 다시 볼 수 있어요</span>}
        </div>
      </div>
    </div>
  );
}
