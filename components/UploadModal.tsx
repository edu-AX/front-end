"use client";
import { useState } from "react";
import { addDays, today as todayFn } from "@/lib/dates";
import { apiUrl } from "@/lib/api";
import { useApp } from "@/lib/state";
import { draftExtras, draftToEventCard } from "@/lib/upload/draft";
import { applyUploadExtras } from "@/lib/uploadExtras";
import type { EventDraft, MaskKind } from "@/lib/types";
import UploadReview from "./UploadReview";

const KIND_LABEL: Record<MaskKind, string> = { phone: "전화번호", studentId: "학번", rrn: "주민번호", email: "이메일", name: "이름" };

type Extract = { fileName: string; charCount: number; maskedText: string; maskCount: number; hits: { kind: MaskKind; count: number }[] };

/** 다음 해 같은 날짜(년도만 +1) */
const nextYear = (d: string | null) => (d ? `${Number(d.slice(0, 4)) + 1}${d.slice(4)}` : addDays(todayFn(), 365));

export default function UploadModal({ onClose, onSaved }: { onClose: () => void; onSaved: (eventId: string) => void }) {
  const { addEvent, updateExt } = useApp();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ex, setEx] = useState<Extract | null>(null);
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [mode, setMode] = useState("");
  const [nextDate, setNextDate] = useState("");

  const upload = async (file: File) => {
    setBusy(true); setErr(null);
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await fetch(apiUrl("/api/upload/extract"), { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error ?? "파일을 처리하지 못했어요");
      setEx(d); setStep(2);
    } catch (e) { setErr(e instanceof Error ? e.message : "파일을 처리하지 못했어요"); }
    setBusy(false);
  };

  const makeDraft = async () => {
    if (!ex) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch(apiUrl("/api/upload/draft"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ maskedText: ex.maskedText }) });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error ?? "초안을 만들지 못했어요");
      setDraft(d.draft); setMode(d.mode); setNextDate(nextYear(d.draft.eventDate)); setStep(3);
    } catch (e) { setErr(e instanceof Error ? e.message : "초안을 만들지 못했어요"); }
    setBusy(false);
  };

  const save = (draft2: EventDraft, nextEventDate: string) => {
    if (!nextEventDate) return;
    const id = `U-${Date.now()}`;
    // 업로드한 보고서는 내년 카드의 "작년 기록"이 되므로, 연도는 보고서의 행사 연도
    const reportYear = draft2.eventDate ? Number(draft2.eventDate.slice(0, 4)) : Number(todayFn().slice(0, 4)) - 1;
    addEvent(draftToEventCard(draft2, { id, nextEventDate, year: reportYear, author: `${reportYear} 담당 교사` }));
    // 예산·장소·고민 기록·담당 이력·진로 탭 데이터
    updateExt((p) => applyUploadExtras(p, id, draftExtras(draft2), reportYear));
    onSaved(id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={`max-h-[90vh] w-full overflow-y-auto overscroll-contain rounded-3xl bg-cream p-6 shadow-xl ${step === 3 ? "max-w-2xl" : "max-w-lg"}`}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">작년 행사 자료 올리기</h2>
          <button onClick={onClose} className="rounded-full bg-white px-3 py-1 text-sm shadow-sm">닫기</button>
        </div>
        <ol className="mb-4 flex gap-2 text-xs">
          {["파일 올리기", "가린 내용 확인", "AI 초안 확인·고치기"].map((l, i) => (
            <li key={l} className={`rounded-full px-3 py-1 font-bold ${step === i + 1 ? "bg-stone-800 text-white" : "bg-white text-stone-400"}`}>{i + 1}. {l}</li>
          ))}
        </ol>
        {err && <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-600">{err}</p>}

        {step === 1 && (
          <div>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-amber-300 bg-white p-8 text-center">
              <span className="text-3xl">📄</span>
              <span className="font-semibold">결과보고서(한글 hwpx · PDF · txt, 4MB 이하)</span>
              <span className="text-xs text-stone-500">올리면 이름·전화번호 등을 먼저 가려서 보여드려요</span>
              <input type="file" accept=".hwpx,.pdf,.txt,application/pdf,text/plain" disabled={busy} className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              <span className="rounded-full bg-amber-400 px-4 py-1.5 text-sm font-bold">{busy ? "처리 중…" : "파일 선택"}</span>
            </label>
            <p className="mt-3 text-[11px] text-stone-400">원본 파일은 서버에 저장하지 않아요. 학생 명단 같은 파일은 올리지 마세요. 옛 형식 한글(.hwp)은 읽지 못하니 한글에서 hwpx 또는 PDF로 다시 저장해 주세요.</p>
          </div>
        )}

        {step === 2 && ex && (
          <div>
            <p className="mb-2 rounded-xl bg-emerald-50 p-3 text-sm">
              <b>{ex.fileName}</b> · {ex.charCount.toLocaleString()}자 중 <b>{ex.maskCount}곳</b>을 가렸어요
              {ex.hits.length > 0 && <> ({ex.hits.map((h) => `${KIND_LABEL[h.kind]} ${h.count}개`).join(", ")})</>}
            </p>
            <pre className="mb-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-2xl bg-white p-3 text-xs">{ex.maskedText}</pre>
            <p className="mb-3 text-[11px] text-orange-600">이름 가리기는 100% 정확하지 않아요. 가려지지 않은 이름이 보이면 파일을 고쳐서 다시 올려 주세요.</p>
            <div className="flex justify-between">
              <button onClick={() => { setStep(1); setEx(null); }} className="rounded-full bg-white px-4 py-2 text-sm shadow-sm">다시 올리기</button>
              <button onClick={makeDraft} disabled={busy} className="rounded-full bg-amber-400 px-4 py-2 text-sm font-bold">{busy ? "초안 만드는 중…" : "이 내용으로 초안 만들기"}</button>
            </div>
          </div>
        )}

        {step === 3 && draft && <UploadReview draft={draft} initialNextDate={nextDate} mode={mode} onSave={save} />}
      </div>
    </div>
  );
}
