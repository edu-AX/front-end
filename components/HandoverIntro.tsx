"use client";
// 첫 진입 "인수인계 받기": 전임자 주의점 확인 → 달라진 기준 → 행사별 작년/올해 → 인수 확인.
// 시연용으로 스크롤 없이 한 화면에 들어오게 2단으로 압축했다.
import { diffDays, formatDDay } from "@/lib/dates";
import { byline, mmdd } from "@/lib/dates-view";
import { buildHandoverBrief } from "@/lib/handover";
import { useApp } from "@/lib/state";
import { useLockBodyScroll } from "@/lib/useLockBodyScroll";

export default function HandoverIntro({ onDone, onOpen }: { onDone: () => void; onOpen: (id: string) => void }) {
  const { state, today, events, acknowledgeNote, acceptHandover, toggleConfirm } = useApp();
  useLockBodyScroll();
  const b = buildHandoverBrief(today, state, events);
  const from = b.from.length ? b.from.join(", ") : `${b.fromYear ?? "작년"} 담당 교사`;
  const pct = b.progress.total ? Math.round((b.progress.acknowledged / b.progress.total) * 100) : 100;

  const start = () => {
    if (!b.accepted) acceptHandover();
    onDone();
  };
  const open = (id: string) => { onDone(); onOpen(id); };

  return (
    // 넓은 화면(lg): 스크롤 없이 한 화면, 칸마다 안쪽 스크롤 / 좁은 화면: 창 전체가 스크롤 (뒤 페이지는 잠금)
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-stone-900/30 p-3 backdrop-blur-[2px] lg:items-center">
      <div className="flex w-full max-w-6xl flex-col rounded-3xl bg-cream p-5 shadow-2xl lg:max-h-full">
        <header className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="text-xs font-bold text-amber-700">📋 창의적 체험활동부 인수인계</div>
            <h1 className="text-xl font-bold">{from}에게서 인수인계가 도착했어요</h1>
          </div>
          <div className="w-56">
            <div className="mb-1 flex justify-between text-[11px] text-stone-500"><span>전임자 메모 확인</span><span>{b.progress.acknowledged} / {b.progress.total}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} /></div>
          </div>
        </header>

        <div className="grid gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-[1.25fr_1fr]">
          {/* ① 꼭 알아야 할 주의점 */}
          <section className="rounded-2xl bg-white p-3 shadow-sm lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain">
            <h2 className="mb-2 text-sm font-bold">① 꼭 알아야 할 주의점</h2>
            <ul className="space-y-1.5">
              {b.keyPoints.map((p) => (
                <li key={p.key}>
                  <label className={`flex cursor-pointer items-start gap-2 rounded-xl px-2 py-1.5 text-xs transition ${p.acknowledged ? "bg-stone-50 text-stone-400" : "bg-yellow-100"}`}>
                    <input type="checkbox" checked={p.acknowledged} onChange={() => acknowledgeNote(p.key)} className="mt-0.5 h-4 w-4 shrink-0 accent-amber-500" />
                    <span className="min-w-0 flex-1 leading-snug">
                      <button type="button" onClick={(e) => { e.preventDefault(); open(p.eventId); }} className="font-bold text-amber-800 hover:underline">
                        {p.eventTitle}{p.stepLabel ? ` › ${p.stepLabel}` : ""}
                      </button>
                      <span className="ml-1 text-[10px] text-stone-400">{byline(p.year, p.author)}</span>
                      <span className="mt-0.5 block line-clamp-2">{p.note}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>

          <div className="flex flex-col gap-3 lg:min-h-0">
            {/* ② 작년과 달라진 기준 */}
            <section className="rounded-2xl bg-white p-3 shadow-sm">
              <h2 className="mb-2 text-sm font-bold">② 작년과 달라진 기준</h2>
              <ul className="space-y-1.5">
                {b.changes.map((c) => {
                  const pending = c.status === "추진 중";
                  return (
                    <li key={c.id} className={`rounded-xl border px-2 py-1.5 text-xs ${pending ? "border-orange-300 bg-orange-50" : "border-amber-300 bg-amber-50"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold">{c.title} <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] text-white ${pending ? "bg-orange-500" : "bg-amber-500"}`}>{c.status}</span></span>
                        <button onClick={() => toggleConfirm(c.id)} className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${c.confirmed ? "bg-stone-200 text-stone-600" : "bg-stone-800 text-white"}`}>{c.confirmed ? "확인함 ✓" : "확인"}</button>
                      </div>
                      <div className="mt-1 leading-snug">{c.before} <b className="mx-1">→</b> {c.after}</div>
                      {pending && <div className="mt-0.5 font-semibold text-orange-700">현행 기준은 그대로 적용돼요 (개정 추진 중, 확정 아님)</div>}
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* ③ 행사별 한 줄 */}
            <section className="rounded-2xl bg-white p-3 shadow-sm lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain">
              <h2 className="mb-1 text-sm font-bold">③ 올해 행사 — 작년엔 이랬어요</h2>
              <ul className="divide-y divide-stone-100">
                {b.events.map((e) => (
                  <li key={e.eventId}>
                    <button onClick={() => open(e.eventId)} className="flex w-full items-center justify-between gap-2 py-1.5 text-left text-xs hover:bg-stone-50">
                      <span className="min-w-0 truncate font-semibold">
                        <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${e.scope === "교내" ? "bg-emerald-400" : "bg-sky-400"}`} />{e.title}
                      </span>
                      <span className="shrink-0 text-stone-500">
                        {e.lastYearDate ? <>작년 {mmdd(e.lastYearDate)} → </> : null}올해 {mmdd(e.eventDate)} <b className="text-stone-700">({formatDDay(diffDays(today, e.eventDate))})</b>
                        {e.issueCount > 0 && <span className="ml-1 rounded bg-red-100 px-1 font-bold text-red-600">작년 문제 {e.issueCount}건</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>

        <footer className="sticky bottom-0 -mx-5 -mb-5 mt-3 flex items-center justify-between gap-2 rounded-b-3xl bg-cream px-5 py-3 lg:static lg:m-0 lg:mt-3 lg:p-0">
          <span className="text-[11px] text-stone-400">주의점은 행사 카드의 단계별 기록에서도 다시 볼 수 있어요.</span>
          <button onClick={start} className="rounded-full bg-stone-800 px-6 py-2.5 text-sm font-bold text-white shadow hover:bg-stone-700">
            {b.accepted ? "대시보드로 돌아가기" : "인수 확인하고 시작하기 →"}
          </button>
        </footer>
      </div>
    </div>
  );
}
