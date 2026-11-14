"use client";
import { useMemo, useState } from "react";
import { apiUrl } from "@/lib/api";
import { buildNotice, countBlanks, NOTICE_LABEL, noticeFacts, type NoticeKind } from "@/lib/notice";
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
  const [copied, setCopied] = useState(false);
  const [selId, setSelId] = useState<string | null>(refs.length ? refs[refs.length - 1].id : null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  if (!ev || !ctx) return null;

  const sel = refs.find((r) => r.id === selId) ?? null;
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

  /** 레퍼런스 파일 올리기 → 개인정보 가리기 → 양식 분석 → 바로 작성 */
  const upload = async (file: File) => {
    setBusy(true); setErr(null);
    try {
      const fd = new FormData(); fd.append("file", file);
      const r1 = await fetch(apiUrl("/api/upload/extract"), { method: "POST", body: fd });
      const e1 = await r1.json();
      if (!r1.ok || e1.error) throw new Error(e1.error ?? "파일을 읽지 못했어요");
      const r2 = await fetch(apiUrl("/api/notice/analyze"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: e1.maskedText }) });
      const a = await r2.json();
      if (!r2.ok || a.error) throw new Error(a.error ?? "양식을 분석하지 못했어요");
      const ref: NoticeRef = { id: `R-${Date.now()}`, name: e1.fileName, text: String(e1.maskedText).slice(0, 20000), summary: a.format.summary, addedAt: today };
      updateExt((p) => ({ noticeRefs: [...(p.noticeRefs ?? []).slice(-4), ref] }));
      setSelId(ref.id); setShowSummary(true);
      await generate(ref);
    } catch (e) {
      setErr(e instanceof TypeError ? "서버에 연결하지 못했어요. 백엔드가 켜져 있는지 확인해 주세요." : e instanceof Error ? e.message : "파일을 처리하지 못했어요");
      setBusy(false);
    }
  };
  const remove = (id: string) => { updateExt((p) => ({ noticeRefs: (p.noticeRefs ?? []).filter((r) => r.id !== id) })); if (selId === id) setSelId(null); };

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* 복사 실패 시 직접 선택해서 복사 */ }
  };
  const print = () => {
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return;
    const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    w.document.write(`<html><head><title>${NOTICE_LABEL[kind]}</title><style>body{font-family:'Malgun Gothic',sans-serif;padding:40px;line-height:1.8;font-size:14px;white-space:pre-wrap}</style></head><body>${esc}</body></html>`);
    w.document.close(); w.focus(); w.print();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto overscroll-contain bg-stone-900/30 p-3 backdrop-blur-[2px] sm:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="가정통신문 초안" className="w-full max-w-3xl rounded-3xl bg-cream p-5 shadow-xl sm:p-6">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">가정통신문 초안</h2>
            <p className="text-sm text-stone-500">{ev.title} · {NOTICE_LABEL[kind]}</p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-full bg-white px-4 py-2 text-sm shadow-sm">닫기</button>
        </div>

        {/* 양식(레퍼런스) */}
        <section className="mb-3 rounded-2xl border border-violet-200 bg-violet-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-violet-900">📑 우리 학교 양식으로 쓰기</h3>
              <p className="text-xs text-violet-800/80">지난번에 보낸 가정통신문(한글·PDF)을 올리면 그 양식을 분석해서, 같은 틀로 이 행사 통신문을 써요. 레퍼런스의 날짜·장소·이름은 가져오지 않아요.</p>
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
            <div className="mt-3 rounded-xl bg-white p-3 text-xs leading-relaxed text-stone-600">
              <div className="mb-1 font-bold text-stone-700">분석한 양식 · {sel.name}</div>
              <ul className="list-disc space-y-0.5 pl-4">{sel.summary.map((l, i) => <li key={i}>{l}</li>)}</ul>
            </div>
          )}
          {err && <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs font-bold text-red-600">{err}</p>}
          {note && !err && <p className="mt-2 text-xs font-bold text-violet-800">{note}</p>}
          {refs.length === 0 && !err && <p className="mt-2 text-[11px] text-violet-700/70">아직 올린 양식이 없어요. 지금 보이는 글은 기본 양식이에요. 올린 양식은 이 브라우저에 가려진 글자만 저장돼요(원본 파일은 저장하지 않아요).</p>}
        </section>

        <p className="mb-3 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
          행사 카드의 값으로 채운 <b>초안</b>이에요. 발송 전에 담당자가 내용을 꼭 확인해 주세요. 동의율·금액처럼 기준과 얽힌 숫자는 학교 규정을 다시 확인하고, <b>학생 이름·연락처는 넣지 마세요.</b>
        </p>

        <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} aria-label="가정통신문 내용"
          className="h-[46vh] w-full resize-y rounded-2xl border border-stone-200 bg-white p-4 font-[inherit] text-sm leading-relaxed" />

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className={blanks ? "font-bold text-orange-600" : "font-bold text-emerald-600"}>{blanks ? `채워야 할 빈칸 ${blanks}곳 (【   】)` : "빈칸을 모두 채웠어요 ✓"}</span>
          {hasPii && <span className="font-bold text-red-600">개인정보로 보이는 글이 {pii.maskCount}곳 있어요. 지워 주세요.</span>}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <button onClick={() => { setText(initial); setNote(null); setErr(null); }} className="rounded-full bg-white px-4 py-2 text-sm shadow-sm">기본 양식 초안으로 되돌리기</button>
          <div className="flex gap-2">
            <button onClick={print} className="rounded-full bg-white px-4 py-2 text-sm font-bold shadow-sm">인쇄 / PDF</button>
            <button onClick={copy} className="rounded-full bg-amber-400 px-5 py-2 text-sm font-bold">{copied ? "복사했어요 ✓" : "복사하기"}</button>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-stone-400">복사한 글은 한글(HWP)에 붙여넣어 학교 서식에 맞추면 돼요. 이 화면의 글은 저장되지 않아요.</p>
      </div>
    </div>
  );
}
