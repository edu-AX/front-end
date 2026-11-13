"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useApp } from "@/lib/state";
import { DEMO_TODAY, events, guidelines, changes, budgets, venues, activeChanges, parse, matchTrack, tracks } from "@/lib/data";
import Logo from "./Logo";
import Calendar from "./Calendar";
import Widgets, { CareerDistribution, ProgressList } from "./Widgets";
import EventLists from "./EventLists";
import EventDrawer, { type TabKey } from "./EventDrawer";
import Character, { type CharMode } from "./Character";
import ChatPanel from "./ChatPanel";

export default function ActivitiesApp() {
  const { s, update, ready } = useApp();
  const t = parse(DEMO_TODAY);
  const [ym, setYm] = useState({ y: t.getUTCFullYear(), m: t.getUTCMonth() + 1 });
  const [open, setOpen] = useState<{ id: string; tab?: TabKey } | null>(null);
  const [guideId, setGuideId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [mode, setMode] = useState<CharMode>("idle");
  const [track, setTrack] = useState("전체");

  const evs = useMemo(() => events.filter((e) => matchTrack(e, track)), [track]);
  const hasAlert = events.some((e) => activeChanges(e, s).length > 0);
  const guide = guidelines.find((g) => g.id === guideId);
  const openEvent = (id: string) => setOpen({ id });

  const openSource = (id: string) => {
    if (id.startsWith("E-")) setOpen({ id });
    else if (id.startsWith("H-E-")) setOpen({ id: id.slice(2), tab: "owner" });
    else if (id.startsWith("C-")) { const c = changes.find((x) => x.id === id); if (c) setOpen({ id: c.eventId }); }
    else if (id.startsWith("B-")) { const b = budgets.find((x) => x.id === id); if (b) setOpen({ id: b.eventId, tab: "budget" }); }
    else if (id.startsWith("V-")) { const e = events.find((x) => x.venueIds.includes(id)); if (e && venues.some((v) => v.id === id)) setOpen({ id: e.id, tab: "venue" }); }
    else setGuideId(id);
  };

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
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800">데모 기준일 {DEMO_TODAY} · 가상 학교 데이터</span>
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
          <Calendar year={ym.y} month={ym.m} onMonth={(y, m) => setYm({ y, m })} s={s} onOpen={openEvent} evs={evs} />
          <EventLists s={s} onOpen={openEvent} evs={evs} />
        </div>
        <div className="space-y-4">
          <ProgressList s={s} onOpen={openEvent} evs={evs} />
          <Widgets s={s} onOpen={openEvent} evs={evs} />
          <CareerDistribution track={track} onTrack={setTrack} />
        </div>
      </div>

      {open && <EventDrawer key={`${open.id}-${open.tab ?? ""}`} id={open.id} tab={open.tab} s={s} update={update} onClose={() => setOpen(null)} />}

      {guide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setGuideId(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold text-white ${guide.status === "추진 중" ? "bg-orange-500" : "bg-emerald-500"}`}>{guide.status}</span>
            <h3 className="mt-2 text-lg font-bold">{guide.title}</h3>
            <p className="text-xs text-stone-500">{guide.scope} · {guide.year} 기준</p>
            <ul className="my-3 list-disc space-y-1 pl-5 text-sm">{guide.sections.map((x) => <li key={x}>{x}</li>)}</ul>
            <div className="flex justify-between text-sm">
              <a href={guide.sourceUrl} target="_blank" rel="noreferrer" className="text-sky-700 underline">출처 보기</a>
              <button onClick={() => setGuideId(null)} className="rounded-full bg-stone-100 px-3 py-1">닫기</button>
            </div>
          </div>
        </div>
      )}

      {ready && !s.hidden && (
        <Character mode={mode} alert={hasAlert && !chatOpen} pos={s.charPos}
          onPos={(p) => update({ charPos: p })} onChat={() => setChatOpen(true)} onHide={() => { update({ hidden: true }); }} />
      )}
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} hidden={ready && s.hidden} openChat={() => setChatOpen(true)}
        onSummon={() => { update({ hidden: false }); setChatOpen(false); }} onSource={openSource} setThinking={(b) => setMode(b ? "think" : "idle")} />
    </div>
  );
}
