"use client";
// 화면 상태. 백엔드와 약속한 ClientState 는 저장소 어댑터(lib/storage.ts)를 통해서만 읽고 씁니다.
// (지금은 localStorage "handover:v1". 서버 저장으로 바꿀 때는 lib/storage.ts 만 교체)
import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { today } from "./dates";
import { allEvents, EMPTY_EXT_STATE, type ExtState } from "./ext";
import { handoverStorage, LOCAL_STATE_KEY, STORAGE_SCOPE } from "./storage";
import { EMPTY_CLIENT_STATE, type ClientState, type DateString, type EventCard, type StepId, type StepState } from "./types";

/** 화면 전용 상태(캐릭터 위치 등). 인수인계 기록이 아니라서 브라우저에만 둔다 */
const EXT_KEY = "handover:ext:v1";

type Ctx = {
  state: ClientState;
  ext: ExtState;
  ready: boolean;
  today: DateString;
  events: EventCard[];
  setStep: (eventId: string, stepId: StepId, st: StepState) => void;
  setEventDate: (eventId: string, date: DateString) => void;
  addNote: (eventId: string, note: string, stepId?: StepId) => void;
  toggleConfirm: (changeId: string) => void;
  /** 인수인계 받기: 전임자 메모 "확인" 토글 (noteKey 값) */
  acknowledgeNote: (key: string) => void;
  /** 인수인계 받기: "인수 확인하고 시작하기" → handoverAcceptedAt = today() */
  acceptHandover: () => void;
  /** 시연 리허설용: 저장된 상태를 지우고 처음(인수인계 받기가 뜨는 상태)으로 */
  resetDemo: () => void;
  addEvent: (card: EventCard) => void;
  updateExt: (p: Partial<ExtState> | ((s: ExtState) => Partial<ExtState>)) => void;
};
const C = createContext<Ctx | null>(null);

/** 시연 초기화용. 데모 저장소(localStorage)만 지운다 — 서버 저장소로 바꾸면 초기화는 하지 않는다 */
function clearStored() {
  try { localStorage.removeItem(LOCAL_STATE_KEY); localStorage.removeItem(EXT_KEY); } catch {}
}

function load<T>(key: string, empty: T): T {
  try { const r = localStorage.getItem(key); if (r) return { ...empty, ...JSON.parse(r) }; } catch {}
  return empty;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ClientState>(EMPTY_CLIENT_STATE);
  const [ext, setExt] = useState<ExtState>(EMPTY_EXT_STATE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 시연 리허설: /high/activities?reset=1 → 저장된 상태를 지우고 처음(인수인계 받기가 뜨는 상태)으로, 쿼리는 지움
    const url = new URL(window.location.href);
    if (url.searchParams.get("reset") === "1") {
      clearStored();
      url.searchParams.delete("reset");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
    setExt(load(EXT_KEY, EMPTY_EXT_STATE));
    let alive = true;
    handoverStorage.load(STORAGE_SCOPE.schoolId, STORAGE_SCOPE.deptId).then((s) => {
      if (!alive) return;
      setState(s ?? EMPTY_CLIENT_STATE);
      setReady(true);
    });
    return () => { alive = false; };
  }, []);
  useEffect(() => { if (ready) void handoverStorage.save(STORAGE_SCOPE.schoolId, STORAGE_SCOPE.deptId, state); }, [state, ready]);
  useEffect(() => { if (ready) try { localStorage.setItem(EXT_KEY, JSON.stringify(ext)); } catch {} }, [ext, ready]);

  const setStep = useCallback<Ctx["setStep"]>((eventId, stepId, st) =>
    setState((p) => ({ ...p, stepStatus: { ...p.stepStatus, [eventId]: { ...p.stepStatus[eventId], [stepId]: st } } })), []);
  const setEventDate = useCallback<Ctx["setEventDate"]>((eventId, date) =>
    setState((p) => ({ ...p, eventDateOverrides: { ...p.eventDateOverrides, [eventId]: date } })), []);
  const addNote = useCallback<Ctx["addNote"]>((eventId, note, stepId) =>
    setState((p) => ({ ...p, extraNotes: { ...p.extraNotes, [eventId]: [...(p.extraNotes[eventId] ?? []), { year: Number(today().slice(0, 4)), note, author: "나", ...(stepId ? { stepId } : {}) }] } })), []);
  const acknowledgeNote = useCallback<Ctx["acknowledgeNote"]>((key) =>
    setState((p) => {
      const cur = p.acknowledgedNoteKeys ?? [];
      return { ...p, acknowledgedNoteKeys: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] };
    }), []);
  const acceptHandover = useCallback<Ctx["acceptHandover"]>(() =>
    setState((p) => ({ ...p, handoverAcceptedAt: today() })), []);
  const resetDemo = useCallback<Ctx["resetDemo"]>(() => {
    clearStored();
    setState(EMPTY_CLIENT_STATE);
    setExt(EMPTY_EXT_STATE);
  }, []);
  const toggleConfirm = useCallback<Ctx["toggleConfirm"]>((id) =>
    setState((p) => ({ ...p, confirmedChangeIds: p.confirmedChangeIds.includes(id) ? p.confirmedChangeIds.filter((x) => x !== id) : [...p.confirmedChangeIds, id] })), []);
  const addEvent = useCallback<Ctx["addEvent"]>((card) => setState((p) => ({ ...p, addedEvents: [...p.addedEvents, card] })), []);
  const updateExt = useCallback<Ctx["updateExt"]>((p) => setExt((prev) => ({ ...prev, ...(typeof p === "function" ? p(prev) : p) })), []);

  const events = useMemo(() => allEvents(state), [state]);
  const value = useMemo(() => ({ state, ext, ready, today: today(), events, setStep, setEventDate, addNote, toggleConfirm, acknowledgeNote, acceptHandover, resetDemo, addEvent, updateExt }),
    [state, ext, ready, events, setStep, setEventDate, addNote, toggleConfirm, acknowledgeNote, acceptHandover, resetDemo, addEvent, updateExt]);
  return <C.Provider value={value}>{children}</C.Provider>;
}
export const useApp = () => {
  const v = useContext(C);
  if (!v) throw new Error("AppProvider missing");
  return v;
};
