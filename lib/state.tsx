"use client";
// 화면 상태. 백엔드와 약속한 ClientState 는 localStorage "handover:v1" 에 그대로 저장합니다.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { today } from "./dates";
import { allEvents, EMPTY_EXT_STATE, type ExtState } from "./ext";
import { EMPTY_CLIENT_STATE, type ClientState, type DateString, type EventCard, type StepId, type StepState } from "./types";

const KEY = "handover:v1";
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

function clearStored() {
  try { localStorage.removeItem(KEY); localStorage.removeItem(EXT_KEY); } catch {}
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
    setState(load(KEY, EMPTY_CLIENT_STATE)); setExt(load(EXT_KEY, EMPTY_EXT_STATE)); setReady(true);
  }, []);
  useEffect(() => { if (ready) try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }, [state, ready]);
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
