"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useApp } from "@/lib/state";
import { buildDashboard } from "@/lib/dashboard";
import { formatDDay } from "@/lib/dates";
import { parse } from "@/lib/dates-view";
import { matchTrack, tracks } from "@/lib/ext";
import type { LocalSource } from "@/lib/extAnswer";
import Logo from "./Logo";
import Calendar from "./Calendar";
import Widgets, { CareerDistribution, LastYearThisTime, ProgressList } from "./Widgets";
import HandoverIntro from "./HandoverIntro";
import { lastYearThisTime } from "@/lib/handover";
import EventLists from "./EventLists";
import EventDrawer, { type TabKey } from "./EventDrawer";
import Character, { type CharMode } from "./Character";
import ChatPanel from "./ChatPanel";
import UploadModal from "./UploadModal";

export default function ActivitiesApp() {
  const { state, ext, ready, today, events, updateExt } = useApp();
  const t = parse(today);
  const [ym, setYm] = useState({ y: t.getUTCFullYear(), m: t.getUTCMonth() + 1 });
  const [open, setOpen] = useState<{ id: string; tab?: TabKey } | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [mode, setMode] = useState<CharMode>("idle");
  const [track, setTrack] = useState("전체");
  const [upload, setUpload] = useState(false);
  const [showIntro, setShowIntro] = useState(false);

  const evs = useMemo(() => events.filter((e) => matchTrack(e.id, track)), [events, track]);
  const dash = useMemo(() => buildDashboard(today, state, events), [today, state, events]);
  const first = dash.upcoming[0];
  // 아리 첫 인사: 작년 이맘때 문제가 있었던 단계가 있으면 그 얘기부터 (인수인계 말투)
  const lyIssue = useMemo(() => lastYearThisTime(today, events).find((x) => x.daysFromToday >= 0 && x.hadIssue), [today, events]);
  const greeting = lyIssue?.memo
    ? `작년 이맘때 ${lyIssue.eventTitle}에서 이런 일이 있었대요: ${lyIssue.memo}`
    : first ? `${first.title} ${formatDDay(first.dDay)}예요!` : null;
  const needIntro = ready && (!state.handoverAcceptedAt || showIntro);
  const openEvent = (id: string) => setOpen({ id });

  // 출처 칩 → 카드 열기. 채팅창이 카드(메모 입력)를 가리지 않도록 채팅창은 닫는다
  const openSource = (s: LocalSource) => { if (s.openEventId) { setOpen({ id: s.openEventId, tab: s.tab }); setChatOpen(false); } };

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 pb-32 pt-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-4">
          <Logo width={120} />
          <div>
            <nav className="text-xs text-stone-500"><Link href="/" className="hover:underline">인덕고등학교</Link> › <Link href="/high" className="hover:underline">부서 선택</Link> › 창의적 체험활동부</nav>
            <h1 className="text-2xl font-bold">창의적 체험활동부 대시보드</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setUpload(true)} className="rounded-full bg-stone-800 px-4 py-1.5 text-sm font-bold text-white shadow-sm hover:bg-stone-700">📂 작년 행사 자료 올리기</button>
          <button onClick={() => setShowIntro(true)} className="rounded-full bg-amber-400 px-4 py-1.5 text-sm font-bold text-stone-800 shadow-sm hover:bg-amber-300">📋 인수인계 다시 보기</button>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800">기준일 {today} · 가상 학교 데이터</span>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-stone-500">진로별 보기</span>
        {["전체", ...tracks].map((x) => (
          <button key={x} onClick={() => setTrack(x)} className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${track === x ? "bg-violet-500 text-white shadow" : "bg-white text-stone-600 shadow-sm hover:bg-violet-50"}`}>{x}</button>
        ))}
        {track !== "전체" && <span className="text-xs text-stone-500">{track} 계열 행사 + 전 학년 공통 행사 {evs.length}건</span>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div>
          <Calendar year={ym.y} month={ym.m} onMonth={(y, m) => setYm({ y, m })} onOpen={openEvent} evs={evs} />
          <EventLists onOpen={openEvent} evs={evs} />
        </div>
        <div className="space-y-4">
          <LastYearThisTime onOpen={openEvent} evs={evs} />
          <ProgressList onOpen={openEvent} evs={evs} />
          <Widgets onOpen={openEvent} evs={evs} />
          <CareerDistribution track={track} onTrack={setTrack} />
        </div>
      </div>

      {open && <EventDrawer key={`${open.id}-${open.tab ?? ""}`} id={open.id} tab={open.tab} onClose={() => setOpen(null)} />}
      {upload && <UploadModal onClose={() => setUpload(false)} onSaved={(id) => { setUpload(false); setOpen({ id }); }} />}

      {needIntro && <HandoverIntro onDone={() => setShowIntro(false)} onOpen={openEvent} />}

      {ready && !ext.hidden && !needIntro && (
        <Character mode={mode} alert={dash.unconfirmedAlertCount > 0 && !chatOpen} greeting={greeting} pos={ext.charPos}
          onPos={(p) => updateExt({ charPos: p })} onChat={() => setChatOpen(true)} onHide={() => updateExt({ hidden: true })} />
      )}
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} hidden={ready && ext.hidden} openChat={() => setChatOpen(true)} focusEventId={open?.id}
        onSummon={() => { updateExt({ hidden: false }); setChatOpen(false); }} onSource={openSource} setThinking={(b) => setMode(b ? "think" : "idle")} />
    </div>
  );
}
