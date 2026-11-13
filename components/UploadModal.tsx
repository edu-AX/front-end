"use client";
import { useState } from "react";
import { addDays, today as todayFn } from "@/lib/dates";
import { apiUrl } from "@/lib/api";
import { useApp } from "@/lib/state";
import { draftToEventCard } from "@/lib/upload/draft";
import type { EventDraft, MaskKind, TemplateId } from "@/lib/types";

const KIND_LABEL: Record<MaskKind, string> = { phone: "전화번호", studentId: "학번", rrn: "주민번호", email: "이메일", name: "이름" };
const TEMPLATE_LABEL: Record<TemplateId, string> = { OUT_OVERNIGHT: "교외 숙박형", OUT_DAY: "교외 1일형", IN_SCHOOL: "교내 행사" };

type Extract = { fileName: string; charCount: number; maskedText: string; maskCount: number; hits: { kind: MaskKind; count: number }[] };

/** 다음 해 같은 날짜(년도만 +1) */
const nextYear = (d: string | null) => (d ? `${Number(d.slice(0, 4)) + 1}${d.slice(4)}` : addDays(todayFn(), 365));

export default function UploadModal({ onClose, onSaved }: { onClose: () => void; onSaved: (eventId: string) => void }) {
  const { addEvent } = useApp();
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

  const save = () => {
    if (!draft || !nextDate) return;
    const id = `U-${Date.now()}`;
    // 업로드한 보고서는 내년 카드의 "작년 기록"이 되므로, 연도는 보고서의 행사 연도
    const reportYear = draft.eventDate ? Number(draft.eventDate.slice(0, 4)) : Number(todayFn().slice(0, 4)) - 1;
    addEvent(draftToEventCard(draft, { id, nextEventDate: nextDate, year: reportYear, author: `${reportYear} 담당 교사` }));
    onSaved(id);
  };

  const input = "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-cream p-6 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">작년 행사 자료 올리기</h2>
          <button onClick={onClose} className="rounded-full bg-white px-3 py-1 text-sm shadow-sm">닫기</button>
        </div>
        <ol className="mb-4 flex gap-2 text-xs">
          {["파일 올리기", "가린 내용 확인", "카드 초안 고치기"].map((l, i) => (
            <li key={l} className={`rounded-full px-3 py-1 font-bold ${step === i + 1 ? "bg-stone-800 text-white" : "bg-white text-stone-400"}`}>{i + 1}. {l}</li>
          ))}
        </ol>
        {err && <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-600">{err}</p>}

        {step === 1 && (
          <div>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-amber-300 bg-white p-8 text-center">
              <span className="text-3xl">📄</span>
              <span className="font-semibold">결과보고서(PDF 또는 txt, 4MB 이하)</span>
              <span className="text-xs text-stone-500">올리면 이름·전화번호 등을 먼저 가려서 보여드려요</span>
              <input type="file" accept=".pdf,.txt,application/pdf,text/plain" disabled={busy} className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              <span className="rounded-full bg-amber-400 px-4 py-1.5 text-sm font-bold">{busy ? "처리 중…" : "파일 선택"}</span>
            </label>
            <p className="mt-3 text-[11px] text-stone-400">원본 파일은 서버에 저장하지 않아요. 학생 명단 같은 파일은 올리지 마세요.</p>
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

        {step === 3 && draft && (
          <div className="space-y-3 text-sm">
            {mode !== "llm" && <p className="rounded-xl bg-amber-50 p-2 text-xs text-amber-800">데모 초안이에요(mode: {mode}). 실제 AI 연결 시 올린 내용으로 만들어져요.</p>}
            <label className="block"><span className="text-xs text-stone-500">행사명</span><input className={input} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block"><span className="text-xs text-stone-500">구분</span>
                <select className={input} value={draft.scope} onChange={(e) => setDraft({ ...draft, scope: e.target.value as EventDraft["scope"] })}><option>교내</option><option>교외</option></select></label>
              <label className="block"><span className="text-xs text-stone-500">유형</span>
                <select className={input} value={draft.template} onChange={(e) => setDraft({ ...draft, template: e.target.value as TemplateId })}>
                  {(Object.keys(TEMPLATE_LABEL) as TemplateId[]).map((t) => <option key={t} value={t}>{TEMPLATE_LABEL[t]}</option>)}</select></label>
            </div>
            <label className="block"><span className="text-xs text-stone-500">내년 행사일 (올해 날짜: {draft.eventDate ?? "알 수 없음"})</span>
              <input type="date" className={input} value={nextDate} onChange={(e) => setNextDate(e.target.value)} /></label>
            <div>
              <div className="mb-1 text-xs text-stone-500">작년 단계별 실제 일자·메모</div>
              <ul className="space-y-1 rounded-2xl bg-white p-3 text-xs">
                {draft.steps.map((s) => <li key={s.stepId} className="flex justify-between gap-2"><span>{s.stepId}</span><span className="text-stone-500">{s.actualDate ?? "-"} {s.memo}</span></li>)}
              </ul>
            </div>
            <label className="block"><span className="text-xs text-stone-500">주의점 (한 줄에 하나)</span>
              <textarea className={`${input} h-20`} value={draft.cautions.join("\n")} onChange={(e) => setDraft({ ...draft, cautions: e.target.value.split("\n").filter((x) => x.trim()) })} /></label>
            <label className="block"><span className="text-xs text-stone-500">내년엔 이렇게 (학생 이름·연락처는 적지 마세요)</span>
              <textarea className={`${input} h-16`} value={draft.handoverNote} onChange={(e) => setDraft({ ...draft, handoverNote: e.target.value })} /></label>
            <div className="flex justify-end"><button onClick={save} disabled={!nextDate || !draft.title.trim()} className="rounded-full bg-stone-800 px-5 py-2 text-sm font-bold text-white">내년 캘린더에 저장</button></div>
          </div>
        )}
      </div>
    </div>
  );
}
