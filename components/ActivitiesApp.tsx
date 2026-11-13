"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/lib/state";
import { buildDashboard } from "@/lib/dashboard";
import { formatDDay } from "@/lib/dates";
import { parse, shortTitle } from "@/lib/dates-view";
import { computeSchedule, effectiveEventDate } from "@/lib/schedule";
import type { ChangeAlert } from "@/lib/types";
import { matchTrack, tracks } from "@/lib/ext";
import type { LocalSource } from "@/lib/extAnswer";
import Logo from "./Logo";
import Calendar from "./Calendar";
import Widgets, { CareerDistribution, LastYearThisTime, ProgressList } from "./Widgets";
import HandoverIntro from "./HandoverIntro";
import UpdateCheckModal from "./UpdateCheckModal";
import { lastYearThisTime } from "@/lib/handover";
import EventLists from "./EventLists";
import EventDrawer, { type TabKey } from "./EventDrawer";
import Character, { type CharMode } from "./Character";
import ChatPanel from "./ChatPanel";
import UploadModal from "./UploadModal";

export default function ActivitiesApp() {
  const { state, ext, ready, today, events, changes, updateExt } = useApp();
  const t = parse(today);
  const [ym, setYm] = useState({ y: t.getUTCFullYear(), m: t.getUTCMonth() + 1 });
  const [open, setOpen] = useState<{ id: string; tab?: TabKey } | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [mode, setMode] = useState<CharMode>("idle");
  const [track, setTrack] = useState("전체");
  const [upload, setUpload] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [updates, setUpdates] = useState(false);
  // 기준 업데이트 확인 창에서 이번에 추가한 변경들
  const [addedInCheck, setAddedInCheck] = useState<ChangeAlert[]>([]);
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null);
  // 마지막으로 연 행사 카드 (아리가 어느 행사를 말할지 고를 때)
  const lastOpened = useRef<string | null>(null);
  useEffect(() => { if (open) lastOpened.current = open.id; }, [open]);

  /**
   * 기준 변경을 추가하고 창을 닫으면:
   * - 영향받는 단계 중 가장 가까운(오늘 이후) 마감일이 있는 달로 캘린더 이동 → ⚠가 바로 보이게
   * - 아리가 "새 기준 변경이 있어요! ○○ 카드의 ⚠를 확인해 보세요" 한 번
   */
  const closeUpdates = () => {
    setUpdates(false);
    if (addedInCheck.length) {
      const hits = addedInCheck.flatMap((c) =>
        c.eventIds.flatMap((id) => {
          const ev = events.find((e) => e.id === id);
          if (!ev) return [];
          const step = c.stepId ? computeSchedule(ev, today, state, undefined, changes).find((s) => s.id === c.stepId) : undefined;
          return [{ ev, due: step?.dueDate ?? effectiveEventDate(ev, state) }];
        }),
      );
      const upcoming = hits.filter((h) => h.due >= today).sort((a, b) => a.due.localeCompare(b.due));
      const target = upcoming[0] ?? [...hits].sort((a, b) => b.due.localeCompare(a.due))[0];
      if (target) setYm({ y: Number(target.due.slice(0, 4)), m: Number(target.due.slice(5, 7)) });
      const named = hits.find((h) => h.ev.id === lastOpened.current)?.ev ?? target?.ev;
      setNotice({
        id: Date.now(),
        text: named ? `새 기준 변경이 있어요! ${shortTitle(named.title)} 카드의 ⚠를 확인해 보세요` : "새 기준 변경이 있어요! 캘린더의 ⚠를 확인해 보세요",
      });
    }
    setAddedInCheck([]);
  };

  const evs = useMemo(() => events.filter((e) => matchTrack(e.id, track)), [events, track]);
  const dash = useMemo(() => buildDashboard(today, state, events, changes), [today, state, events, changes]);
  const first = dash.upcoming[0];
  // 아리 첫 인사: 작년 이맘때 문제가 있었던 단계가 있으면 그 얘기부터 (인수인계 말투)
  const lyIssue = useMemo(() => lastYearThisTime(today, events).find((x) => x.daysFromToday >= 0 && x.hadIssue), [today, events]);
  const greeting = lyIssue?.memo
    ? `작년 이맘때 ${lyIssue.eventTitle}에서 이런 일이 있었대요: ${lyIssue.memo}`
    : first ? `${first.title} ${formatDDay(first.dDay)}예요!` : null;
  const needIntro = ready && (!state.handoverAcceptedAt || showIntro);
  const openEvent = (id: string) => setOpen({ id });

  // 행사 화면은 전체 화면 페이지처럼: 열면 브라우저 기록을 하나 쌓고, "뒤로"(화면 버튼·브라우저 뒤로·Esc)로 닫는다
  const pushedHistory = useRef(false);
  useEffect(() => {
    if (open && !pushedHistory.current) {
      window.history.pushState({ eventPage: true }, "");
      pushedHistory.current = true;
    }
  }, [open]);
  useEffect(() => {
    const onPop = () => {
      if (!pushedHistory.current) return;
      pushedHistory.current = false;
      setOpen(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const closeEvent = () => {
    if (pushedHistory.current) window.history.back(); // popstate 에서 닫힘
    else setOpen(null);
  };

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
          <button onClick={() => setUpdates(true)} className="rounded-full bg-sky-500 px-4 py-1.5 text-sm font-bold text-white shadow-sm hover:bg-sky-400">🔄 기준 업데이트 확인</button>
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

      {open && <EventDrawer key={`${open.id}-${open.tab ?? ""}`} id={open.id} tab={open.tab} onClose={closeEvent} />}
      {upload && <UploadModal onClose={() => setUpload(false)} onSaved={(id) => { setUpload(false); setOpen({ id }); }} />}

      {needIntro && <HandoverIntro onDone={() => setShowIntro(false)} onOpen={openEvent} />}
      {updates && <UpdateCheckModal onClose={closeUpdates} onAdded={(c) => setAddedInCheck((x) => [...x, c])} onOpenEvent={openEvent} />}

      {ready && !ext.hidden && !needIntro && (
        <Character mode={mode} alert={dash.unconfirmedAlertCount > 0 && !chatOpen} greeting={greeting} notice={notice} pos={ext.charPos}
          onPos={(p) => updateExt({ charPos: p })} onChat={() => setChatOpen(true)} onHide={() => updateExt({ hidden: true })} />
      )}
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} hidden={ready && ext.hidden} openChat={() => setChatOpen(true)} focusEventId={open?.id}
        onSummon={() => { updateExt({ hidden: false }); setChatOpen(false); }} onSource={openSource} setThinking={(b) => setMode(b ? "think" : "idle")} />
    </div>
  );
}
