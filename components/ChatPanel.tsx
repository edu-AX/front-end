"use client";
import { useEffect, useRef, useState } from "react";
import { answerExt, type LocalResponse, type LocalSource } from "@/lib/extAnswer";
import { apiUrl } from "@/lib/api";
import { useApp } from "@/lib/state";

export type Msg = { role: "user" | "bot"; text: string; sources?: LocalSource[]; mode?: string };

// 데모 고정 답이 있는 4개: 인터넷이 끊겨도 안전
const samples = ["작년엔 수학여행 어떻게 했어?", "동의율은 몇 % 넘어야 해?", "안전요원 몇 명 있어야 해?", "사고 나면 교사 책임은?", "진로활동 특기사항 몇 자까지야?"];
const FIRST_DISCLAIMER = "AI가 만든 답변이며 최종 판단은 담당자가 합니다.";

export default function ChatPanel({ open, onClose, hidden, onSummon, onSource, setThinking, openChat, focusEventId }: {
  open: boolean; onClose: () => void; hidden: boolean; onSummon: () => void; openChat: () => void;
  onSource: (s: LocalSource) => void; setThinking: (b: boolean) => void; focusEventId?: string;
}) {
  const { state } = useApp();
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "bot", text: "안녕하세요! 등록된 행사 카드와 지침 안에서만 답해드려요." }]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [disclaimer, setDisclaimer] = useState(FIRST_DISCLAIMER);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, open]);

  const ask = async (q: string) => {
    if (!q.trim() || busy) return;
    openChat();
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setText(""); setBusy(true); setThinking(true);
    try {
      const local = answerExt(q, focusEventId);
      let data: LocalResponse;
      if (local) {
        await new Promise((r) => setTimeout(r, 500));
        data = local;
      } else {
        const { addedEvents: _omit, ...clientState } = state;
        void _omit;
        const r = await fetch(apiUrl("/api/chat"), {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: q, focusEventId, state: clientState }),
        });
        const body = await r.json();
        if (!r.ok) { setMsgs((m) => [...m, { role: "bot", text: body.error ?? "요청을 처리하지 못했어요." }]); setBusy(false); setThinking(false); return; }
        data = body;
      }
      setDisclaimer(data.disclaimer || FIRST_DISCLAIMER);
      setMsgs((m) => [...m, { role: "bot", text: data.answer, sources: data.sources, mode: data.mode }]);
    } catch {
      setMsgs((m) => [...m, { role: "bot", text: "연결에 문제가 생겼어요. 잠시 후 다시 시도해 주세요." }]);
    }
    setBusy(false); setThinking(false);
  };

  const form = (
    <form onSubmit={(e) => { e.preventDefault(); ask(text); }} className="flex gap-2">
      <input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="무엇이든 물어보세요" className="min-w-0 flex-1 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm" />
      <button className="rounded-full bg-amber-400 px-4 py-2 text-sm font-bold" disabled={busy}>보내기</button>
    </form>
  );

  return (
    <>
      {open && (
        <div className={`fixed right-4 z-40 flex h-[480px] w-[340px] flex-col rounded-3xl bg-cream shadow-2xl ${hidden ? "bottom-20" : "bottom-4"}`}>
          <div className="flex items-center justify-between rounded-t-3xl bg-amber-300 px-4 py-2.5 font-bold">아리에게 물어보기<button onClick={onClose} className="text-sm font-normal">닫기</button></div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-right" : ""}>
                <div className={`inline-block max-w-[90%] whitespace-pre-line rounded-2xl px-3 py-2 text-left ${m.role === "user" ? "bg-amber-200" : "bg-white shadow-sm"}`}>{m.text}</div>
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {m.sources.map((s) => {
                      const pending = s.status === "추진 중";
                      const cls = pending ? "bg-orange-200 text-orange-900" : "bg-sky-100 text-sky-900";
                      return s.openEventId ? (
                        <button key={s.id} onClick={() => onSource(s)} className={`rounded-full px-2 py-0.5 text-[11px] ${cls}`}>{s.label}{pending ? " · 추진 중" : ""}</button>
                      ) : (
                        <span key={s.id} className={`cursor-default rounded-full px-2 py-0.5 text-[11px] opacity-80 ${cls}`}>{s.label}{pending ? " · 추진 중" : ""}</span>
                      );
                    })}
                  </div>
                )}
                {m.mode && <div className="mt-0.5 text-[9px] text-stone-300">{m.mode}</div>}
              </div>
            ))}
            {msgs.length === 1 && <div className="flex flex-wrap gap-1.5 pt-1">{samples.map((q) => <button key={q} onClick={() => ask(q)} className="rounded-full border border-amber-300 bg-white px-2.5 py-1 text-xs">{q}</button>)}</div>}
            {busy && <div className="text-stone-400">···</div>}
            <div ref={end} />
          </div>
          <div className="space-y-1.5 p-3 pt-0">{!hidden && form}<p className="text-center text-[10px] text-stone-400">{disclaimer}</p></div>
        </div>
      )}
      {hidden && (
        <div className="fixed bottom-4 left-1/2 z-40 flex w-[min(520px,92vw)] -translate-x-1/2 items-center gap-2 rounded-full bg-white p-2 shadow-xl">
          <div className="min-w-0 flex-1">
            <form onSubmit={(e) => { e.preventDefault(); ask(text); }} className="flex">
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="무엇이든 물어보세요" className="min-w-0 flex-1 rounded-full px-4 py-2 text-sm outline-none" />
              <button className="rounded-full bg-amber-400 px-4 py-2 text-sm font-bold" disabled={busy}>보내기</button>
            </form>
          </div>
          <button onClick={onSummon} className="shrink-0 rounded-full bg-stone-100 px-3 py-2 text-xs">🐥 부르기</button>
        </div>
      )}
    </>
  );
}
