"use client";
import { useMemo, useState } from "react";
import { buildNotice, countBlanks, NOTICE_LABEL, type NoticeKind } from "@/lib/notice";
import { maskPersonalInfo } from "@/lib/masking";
import { computeSchedule, effectiveEventDate } from "@/lib/schedule";
import { settlementSteps } from "@/lib/ext";
import { useApp } from "@/lib/state";
import { useEscape } from "@/lib/useEscape";
import { useLockBodyScroll } from "@/lib/useLockBodyScroll";

export default function NoticeModal({ eventId, kind, onClose }: { eventId: string; kind: NoticeKind; onClose: () => void }) {
  const { state, ext, today, events, changes } = useApp();
  useLockBodyScroll();
  useEscape(onClose);
  const ev = events.find((e) => e.id === eventId);

  const initial = useMemo(() => {
    if (!ev) return "";
    const date = effectiveEventDate(ev, state);
    const schedule = computeSchedule(ev, today, state, undefined, changes);
    const extra = settlementSteps(ev, state, ext);
    return buildNotice(kind, ev, {
      date, today, schedule,
      settleDue: extra.find((s) => s.id === "settle")?.dueDate,
      discloseDue: extra.find((s) => s.id === "disclose")?.dueDate,
    });
    // 열 때 한 번만 채운다 (이후엔 담당자가 직접 고친 글을 유지)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [text, setText] = useState(initial);
  const [copied, setCopied] = useState(false);
  if (!ev) return null;

  const blanks = countBlanks(text);
  const pii = maskPersonalInfo(text);
  const hasPii = pii.maskCount > 0;

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
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="가정통신문 초안" className="w-full max-w-2xl rounded-3xl bg-cream p-5 shadow-xl sm:p-6">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">가정통신문 초안</h2>
            <p className="text-sm text-stone-500">{ev.title} · {NOTICE_LABEL[kind]}</p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-full bg-white px-4 py-2 text-sm shadow-sm">닫기</button>
        </div>

        <p className="mb-3 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
          행사 카드의 값으로 채운 <b>초안</b>이에요. 발송 전에 담당자가 내용을 꼭 확인해 주세요. 동의율·금액처럼 기준과 얽힌 숫자는 학교 규정을 다시 확인하고, <b>학생 이름·연락처는 넣지 마세요.</b>
        </p>

        <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} aria-label="가정통신문 내용"
          className="h-[52vh] w-full resize-y rounded-2xl border border-stone-200 bg-white p-4 font-[inherit] text-sm leading-relaxed" />

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className={blanks ? "font-bold text-orange-600" : "font-bold text-emerald-600"}>{blanks ? `채워야 할 빈칸 ${blanks}곳 (【   】)` : "빈칸을 모두 채웠어요 ✓"}</span>
          {hasPii && <span className="font-bold text-red-600">개인정보로 보이는 글이 {pii.maskCount}곳 있어요. 지워 주세요.</span>}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <button onClick={() => setText(initial)} className="rounded-full bg-white px-4 py-2 text-sm shadow-sm">처음 초안으로 되돌리기</button>
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
