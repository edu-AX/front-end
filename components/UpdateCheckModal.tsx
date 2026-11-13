"use client";
// "🔄 기준 업데이트 확인": 공식 출처 확인 → AI가 정리한 기준 변경 후보 → 담당자가 확인해야 변경 알림에 반영.
// 기준 값은 자동으로 바뀌지 않는다. (지금은 백엔드의 시연용 스냅샷으로 동작)
import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";
import { getTemplate } from "@/lib/data";
import { mmdd } from "@/lib/dates-view";
import { useApp } from "@/lib/state";
import type { ChangeAlert, UpdateCheckResult } from "@/lib/types";
import { useLockBodyScroll } from "@/lib/useLockBodyScroll";

const STEP_MS = 300; // 출처 한 줄씩 체크되는 간격 (4곳 → 1.2초)
const shortTitle = (t: string) => t.replace(/\(.*?\)/g, "").replace(/^\s*\d학년\s*/, "").trim();
const dot = (d?: string) => (d ? `${d.slice(0, 4)}.${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}` : "");

export default function UpdateCheckModal({ onClose, onAdded, onOpenEvent }: {
  onClose: () => void;
  /** 후보를 변경 알림에 추가했을 때 (아리 말풍선 등) */
  onAdded: (c: ChangeAlert) => void;
  onOpenEvent: (id: string) => void;
}) {
  const { state, events, changes, addChange } = useApp();
  useLockBodyScroll();
  const [phase, setPhase] = useState<"loading" | "checking" | "done" | "error">("loading");
  const [res, setRes] = useState<UpdateCheckResult | null>(null);
  const [shown, setShown] = useState(0);
  const [ignored, setIgnored] = useState<string[]>([]);

  // 1) 백엔드에 확인 요청 (지금까지 추가한 변경을 같이 보내서 중복을 거른다)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { addedEvents: _omit, ...clientState } = state;
        void _omit;
        const r = await fetch(apiUrl("/api/updates/check"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state: clientState }),
        });
        if (!r.ok) throw new Error(String(r.status));
        const d = (await r.json()) as UpdateCheckResult;
        if (!alive) return;
        setRes(d);
        setPhase("checking");
      } catch {
        if (alive) setPhase("error");
      }
    })();
    return () => { alive = false; };
    // 열릴 때 한 번만 확인
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) 출처를 한 줄씩 ✓ 처리하는 애니메이션
  useEffect(() => {
    if (phase !== "checking" || !res) return;
    if (shown >= res.sources.length) {
      const t = setTimeout(() => setPhase("done"), 250);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setShown((n) => n + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [phase, shown, res]);

  const isAdded = (id: string) => changes.some((c) => c.id === id);
  const evTitle = (id: string) => shortTitle(events.find((e) => e.id === id)?.title ?? id);
  const stepLabel = (c: ChangeAlert) => {
    const ev = events.find((e) => c.eventIds.includes(e.id));
    return c.stepId && ev ? getTemplate(ev.template).steps.find((s) => s.id === c.stepId)?.label : undefined;
  };
  const candidates = (res?.found ?? []).filter((c) => !ignored.includes(c.id));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-stone-900/30 p-3 backdrop-blur-[2px] sm:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl rounded-3xl bg-cream p-5 shadow-2xl">
        <header className="mb-3 flex items-start justify-between gap-2">
          <div>
            <div className="text-xs font-bold text-sky-700">🔄 기준 업데이트 확인</div>
            <h2 className="text-lg font-bold">{phase === "done" ? "공식 출처 확인을 마쳤어요" : "공식 출처에서 기준 변경을 찾고 있어요"}</h2>
          </div>
          <button onClick={onClose} className="rounded-full bg-white px-3 py-1 text-sm shadow-sm">닫기</button>
        </header>

        {/* 출처 확인 */}
        <section className="mb-3 rounded-2xl bg-white p-3 shadow-sm">
          {phase === "loading" && <p className="animate-pulse text-sm text-stone-500">공식 출처에 연결하는 중…</p>}
          {phase === "error" && (
            <p className="text-sm text-red-600">백엔드에 연결하지 못했어요. 백엔드 서버(포트 3001)가 켜져 있는지 확인하세요.</p>
          )}
          {res && (
            <ul className="space-y-1.5 text-sm">
              {res.sources.map((s, i) => {
                const doneRow = phase === "done" || i < shown;
                return (
                  <li key={s.id} className="flex items-center justify-between gap-2">
                    <span className={doneRow ? "" : "text-stone-400"}>{s.name}</span>
                    {doneRow ? (
                      <span className={`shrink-0 text-xs font-bold ${s.newDocs ? "text-sky-700" : "text-stone-400"}`}>
                        ✓ {s.newDocs ? `새 문서 ${s.newDocs}건` : "새 문서 없음"}
                      </span>
                    ) : (
                      <span className="shrink-0 animate-pulse text-xs text-stone-400">확인 중…</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {phase === "done" && res && (
          <>
            <p className="mb-2 text-sm font-bold">
              새로운 기준 변경 <span className="text-orange-600">{res.found.length}건</span>
              <span className="mx-1 text-stone-300">·</span>
              이미 반영된 변경 {res.alreadyKnown.length}건
            </p>

            <div className="space-y-3">
              {candidates.map((c) => {
                const added = isAdded(c.id);
                const pending = c.status === "추진 중";
                const step = stepLabel(c);
                return (
                  <article key={c.id} className={`rounded-2xl border-2 bg-white p-4 text-sm shadow-sm ${pending ? "border-orange-200" : "border-amber-200"}`}>
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <b className="text-base">{c.title}</b>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold text-white ${pending ? "bg-orange-500" : "bg-amber-500"}`}>{c.status}</span>
                    </div>
                    <div className="mb-2 text-xs text-stone-500">{c.source}{c.publishedAt ? ` · 발표 ${dot(c.publishedAt)}` : ""}</div>

                    <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-stone-500">영향 행사</span>
                      {c.eventIds.map((id) => (
                        <button key={id} onClick={() => { onClose(); onOpenEvent(id); }} className="rounded-full bg-sky-100 px-2 py-0.5 font-semibold text-sky-800 hover:bg-sky-200">{evTitle(id)}</button>
                      ))}
                    </div>
                    {step && <div className="mb-2 text-xs"><span className="text-stone-500">영향 단계</span> <b>{step}</b></div>}

                    <div className="mb-2 rounded-xl bg-stone-50 px-3 py-2 text-xs">
                      {c.before} <b className="mx-1">→</b> {c.after}
                    </div>
                    {pending && <p className="mb-2 text-xs font-semibold text-orange-700">추진 중이에요. 확정 전까지 현행 기준이 그대로 적용돼요.</p>}

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {c.url ? (
                        <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-sky-700 underline">원문 보기 ↗</a>
                      ) : (
                        <span className="cursor-not-allowed text-xs text-stone-300" title="원문 링크 준비 중">원문 보기</span>
                      )}
                      <div className="flex gap-2">
                        {added ? (
                          <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700">변경 알림에 추가됨 ✓</span>
                        ) : (
                          <>
                            <button onClick={() => setIgnored((x) => [...x, c.id])} className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-bold text-stone-600 hover:bg-stone-200">무시</button>
                            <button onClick={() => { addChange(c); onAdded(c); }} className="rounded-full bg-stone-800 px-4 py-1.5 text-xs font-bold text-white hover:bg-stone-700">변경 알림에 추가</button>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
              {res.found.length > 0 && candidates.length === 0 && <p className="text-sm text-stone-400">모든 후보를 무시했어요.</p>}
              {res.found.length === 0 && <p className="text-sm text-stone-500">새로 찾은 기준 변경이 없어요.</p>}
            </div>

            {res.alreadyKnown.length > 0 && (
              <p className="mt-3 text-xs text-stone-500">
                이미 반영됨: {res.alreadyKnown.map((id) => changes.find((c) => c.id === id)?.title ?? id).join(", ")}
              </p>
            )}
          </>
        )}

        <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 pt-3">
          <p className="text-xs font-semibold text-stone-600">
            🤝 AI가 공식 출처에서 찾은 후보예요. 담당자가 확인해야 반영되고, 기준 값은 자동으로 바뀌지 않아요.
          </p>
          {res?.snapshot && <span className="text-[10px] text-stone-400">{res.snapshotLabel ?? "시연용 스냅샷"}</span>}
        </footer>
      </div>
    </div>
  );
}
