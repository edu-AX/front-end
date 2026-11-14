"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiUrl } from "@/lib/api";
import { buildNotice, countBlanks, NOTICE_LABEL, noticeFacts, type NoticeKind } from "@/lib/notice";
import { DEFAULT_DESIGN, noticePrintDocument, noticeToHtml } from "@/lib/noticeDesign";
import { maskPersonalInfo } from "@/lib/masking";
import { computeSchedule, effectiveEventDate } from "@/lib/schedule";
import { settlementSteps, type NoticeRef } from "@/lib/ext";
import { useApp } from "@/lib/state";
import { useEscape } from "@/lib/useEscape";
import { useLockBodyScroll } from "@/lib/useLockBodyScroll";

const MODE_NOTE: Record<string, string> = {
  llm: "AI가 레퍼런스 양식에 맞춰 작성했어요.",
  demo: "레퍼런스의 양식을 분석해 그 틀대로 채웠어요. (데모 모드: AI 없이 규칙으로 작성)",
  fallback: "레퍼런스의 양식을 분석해 그 틀대로 채웠어요. (AI 연결이 안 돼 규칙으로 작성)",
};

export default function NoticeModal({ eventId, kind, onClose }: { eventId: string; kind: NoticeKind; onClose: () => void }) {
  const { state, ext, today, events, changes, updateExt } = useApp();
  useLockBodyScroll();
  useEscape(onClose);
  const ev = events.find((e) => e.id === eventId);

  const ctx = useMemo(() => {
    if (!ev) return null;
    const date = effectiveEventDate(ev, state);
    const schedule = computeSchedule(ev, today, state, undefined, changes);
    const extra = settlementSteps(ev, state, ext);
    return {
      date, today, schedule,
      settleDue: extra.find((s) => s.id === "settle")?.dueDate,
      discloseDue: extra.find((s) => s.id === "disclose")?.dueDate,
    };
    // 열 때 한 번만 계산한다 (이후엔 담당자가 직접 고친 글을 유지)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const initial = useMemo(() => (ev && ctx ? buildNotice(kind, ev, ctx) : ""), [ev, ctx, kind]);

  const refs = ext.noticeRefs ?? [];
  const [text, setText] = useState(initial);
  const [view, setView] = useState<"paper" | "edit">("paper");
  const [copied, setCopied] = useState(false);
  const [selId, setSelId] = useState<string | null>(refs.length ? refs[refs.length - 1].id : null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  const sel = refs.find((r) => r.id === selId) ?? null;
  const design = sel?.design ?? DEFAULT_DESIGN;
  const html = useMemo(() => noticeToHtml(text, design, { highlightBlanks: true }), [text, design]);

  // 용지 미리보기를 상자 너비에 맞춰 줄인다
  const box = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, height: 0 });
  useEffect(() => {
    if (view !== "paper") return;
    const calc = () => {
      if (!box.current || !paper.current) return;
      const pagePx = (design.pageMm[0] / 25.4) * 96;
      const scale = Math.min(1, (box.current.clientWidth - 24) / pagePx);
      setFit({ scale, height: paper.current.scrollHeight * scale });
    };
    calc();
    const ro = new ResizeObserver(calc);
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, [view, html, design.pageMm]);

  if (!ev || !ctx) return null;

  const blanks = countBlanks(text);
  const pii = maskPersonalInfo(text);
  const hasPii = pii.maskCount > 0;

  /** 선택한 레퍼런스의 양식에 맞춰 통신문을 새로 쓴다 */
  const generate = async (ref: NoticeRef) => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(apiUrl("/api/notice/draft"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, facts: noticeFacts(ev, ctx), references: [{ name: ref.name, text: ref.text }] }),
      });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error ?? "통신문을 만들지 못했어요");
      setText(d.text); setNote(MODE_NOTE[d.mode] ?? MODE_NOTE.demo); setSelId(ref.id);
    } catch (e) {
      setErr(e instanceof TypeError ? "서버에 연결하지 못했어요. 백엔드가 켜져 있는지 확인해 주세요." : e instanceof Error ? e.message : "통신문을 만들지 못했어요");
    }
    setBusy(false);
  };

  /** 레퍼런스 파일 올리기 → 개인정보 가리기 → 양식(구성)·디자인(모양) 분석 → 바로 작성 */
  const upload = async (file: File) => {
    setBusy(true); setErr(null);
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await fetch(apiUrl("/api/notice/reference"), { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error ?? "파일을 읽지 못했어요");
      const ref: NoticeRef = {
        id: `R-${Date.now()}`, name: d.fileName, text: String(d.maskedText).slice(0, 20000),
        summary: d.format.summary, design: d.design, designSummary: [...d.design.summary, ...(d.designNote ? [d.designNote] : [])], addedAt: today,
      };
      updateExt((p) => ({ noticeRefs: [...(p.noticeRefs ?? []).slice(-3), ref] })); // 그림이 들어 있어 최대 4개까지만 보관
      setSelId(ref.id); setShowSummary(true);
      await generate(ref);
    } catch (e) {
      setErr(e instanceof TypeError ? "서버에 연결하지 못했어요. 백엔드가 켜져 있는지 확인해 주세요." : e instanceof Error ? e.message : "파일을 처리하지 못했어요");
      setBusy(false);
    }
  };
  const remove = (id: string) => { updateExt((p) => ({ noticeRefs: (p.noticeRefs ?? []).filter((r) => r.id !== id) })); if (selId === id) setSelId(null); };

  const copyPlain = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* 복사 실패 시 직접 선택해서 복사 */ }
  };
  /** 서식 포함 복사: 한글·워드에 붙여넣으면 표·굵기·글자 크기가 그대로 따라온다 */
  const copyRich = async () => {
    try {
      const h = noticeToHtml(text, design);
      await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([h], { type: "text/html" }), "text/plain": new Blob([text], { type: "text/plain" }) })]);
      setCopied(true); setTimeout(() => setCopied(false), 1800);
    } catch { await copyPlain(); }
  };
  const print = () => {
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) return;
    w.document.write(noticePrintDocument(text, design, `${ev.title} ${NOTICE_LABEL[kind]}`));
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto overscroll-contain bg-stone-900/30 p-3 backdrop-blur-[2px] sm:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="가정통신문 초안" className="w-full max-w-4xl rounded-3xl bg-cream p-5 shadow-xl sm:p-6">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">가정통신문 초안</h2>
            <p className="text-sm text-stone-500">{ev.title} · {NOTICE_LABEL[kind]}</p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-full bg-white px-4 py-2 text-sm shadow-sm">닫기</button>
        </div>

        {/* 양식·디자인(레퍼런스) */}
        <section className="mb-3 rounded-2xl border border-violet-200 bg-violet-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-violet-900">📑 우리 학교 양식·디자인으로 쓰기</h3>
              <p className="text-xs text-violet-800/80">지난번에 보낸 가정통신문(한글 hwp·PDF)을 올리면 글 구성뿐 아니라 글꼴·크기·머리말 상자·표 색 같은 <b>디자인</b>까지 읽어서 같은 모양으로 만들어요. 레퍼런스의 날짜·장소·이름은 가져오지 않아요.</p>
            </div>
            <label className={`shrink-0 cursor-pointer rounded-full bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-violet-700 ${busy ? "pointer-events-none opacity-60" : ""}`}>
              {busy ? "처리 중…" : "양식 올리기"}
              <input type="file" accept=".hwp,.hwpx,.pdf,.txt,application/pdf,text/plain" className="hidden" disabled={busy}
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
            </label>
          </div>

          {refs.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {refs.map((r) => (
                <li key={r.id} className={`flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-sm ${r.id === selId ? "bg-white shadow-sm ring-1 ring-violet-300" : "bg-white/60"}`}>
                  <button type="button" onClick={() => { setSelId(r.id); setShowSummary(true); }} className="min-w-0 flex-1 truncate text-left font-semibold">{r.id === selId ? "● " : "○ "}{r.name}</button>
                  <button type="button" disabled={busy} onClick={() => void generate(r)} className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-800 hover:bg-violet-200 disabled:opacity-50">이 양식으로 쓰기</button>
                  <button type="button" onClick={() => remove(r.id)} aria-label="양식 지우기" className="rounded-full px-2 py-1 text-xs text-stone-400 hover:bg-stone-100">지우기</button>
                </li>
              ))}
            </ul>
          )}

          {sel && showSummary && (
            <div className="mt-3 grid gap-3 rounded-xl bg-white p-3 text-xs leading-relaxed text-stone-600 sm:grid-cols-2">
              <div>
                <div className="mb-1 font-bold text-stone-700">글 구성 · {sel.name}</div>
                <ul className="list-disc space-y-0.5 pl-4">{sel.summary.map((l, i) => <li key={i}>{l}</li>)}</ul>
              </div>
              <div>
                <div className="mb-1 font-bold text-stone-700">디자인</div>
                <ul className="list-disc space-y-0.5 pl-4">{(sel.designSummary ?? sel.design?.summary ?? ["디자인 정보 없음(기본 디자인)"]).map((l, i) => <li key={i}>{l}</li>)}</ul>
              </div>
            </div>
          )}
          {err && <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs font-bold text-red-600">{err}</p>}
          {note && !err && <p className="mt-2 text-xs font-bold text-violet-800">{note}</p>}
          {refs.length === 0 && !err && <p className="mt-2 text-[11px] text-violet-700/70">아직 올린 양식이 없어요. 지금 보이는 글과 모양은 기본이에요. 올린 양식은 이 브라우저에 가려진 글자·디자인 값만 저장돼요(원본 파일은 저장하지 않아요).</p>}
        </section>

        <p className="mb-3 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
          행사 카드의 값으로 채운 <b>초안</b>이에요. 발송 전에 담당자가 내용을 꼭 확인해 주세요. 동의율·금액처럼 기준과 얽힌 숫자는 학교 규정을 다시 확인하고, <b>학생 이름·연락처는 넣지 마세요.</b>
        </p>

        <div className="mb-2 flex gap-1 rounded-full bg-white p-1 text-sm shadow-sm sm:w-fit">
          {([["paper", "🖨 양식대로 미리보기"], ["edit", "✏️ 글 고치기"]] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setView(k)} className={`rounded-full px-4 py-1.5 font-bold ${view === k ? "bg-stone-800 text-white" : "text-stone-500 hover:bg-stone-100"}`}>{l}</button>
          ))}
        </div>

        {view === "paper" ? (
          // 용지 전체를 잘림 없이 보여준다 (안쪽 스크롤 없이 창 자체가 스크롤됨). 상자 너비에 맞춰 줄이고 가운데 놓는다
          <div ref={box} className="rounded-2xl border border-stone-200 bg-stone-200 p-2 sm:p-3">
            <div style={{ width: (design.pageMm[0] / 25.4) * 96 * fit.scale, height: fit.height || undefined, margin: "0 auto" }}>
              <div ref={paper} style={{ transform: `scale(${fit.scale})`, transformOrigin: "top left", width: `${design.pageMm[0]}mm`, boxShadow: "0 1px 6px rgba(0,0,0,.25)" }} dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          </div>
        ) : (
          <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} aria-label="가정통신문 내용"
            className="h-[52vh] w-full resize-y rounded-2xl border border-stone-200 bg-white p-4 font-[inherit] text-sm leading-relaxed" />
        )}
        <p className="mt-1 text-[11px] text-stone-400">{view === "paper" ? "노란 표시는 채워야 할 빈칸이에요. 글을 바꾸려면 「글 고치기」를 눌러 주세요." : "고친 글은 「양식대로 미리보기」에서 바로 디자인이 입혀져요."}</p>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className={blanks ? "font-bold text-orange-600" : "font-bold text-emerald-600"}>{blanks ? `채워야 할 빈칸 ${blanks}곳 (【   】)` : "빈칸을 모두 채웠어요 ✓"}</span>
          {hasPii && <span className="font-bold text-red-600">개인정보로 보이는 글이 {pii.maskCount}곳 있어요. 지워 주세요.</span>}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <button onClick={() => { setText(initial); setNote(null); setErr(null); setSelId(null); }} className="rounded-full bg-white px-4 py-2 text-sm shadow-sm">기본 양식 초안으로 되돌리기</button>
          <div className="flex flex-wrap gap-2">
            <button onClick={print} className="rounded-full bg-white px-4 py-2 text-sm font-bold shadow-sm">인쇄 / PDF</button>
            <button onClick={copyPlain} className="rounded-full bg-white px-4 py-2 text-sm font-bold shadow-sm">글만 복사</button>
            <button onClick={copyRich} className="rounded-full bg-amber-400 px-5 py-2 text-sm font-bold">{copied ? "복사했어요 ✓" : "서식 포함 복사"}</button>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-stone-400">「서식 포함 복사」는 한글(HWP)·워드에 붙여넣으면 표와 글자 크기가 그대로 따라와요. 이 화면의 글은 저장되지 않아요.</p>
      </div>
    </div>
  );
}
