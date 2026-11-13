"use client";
// 화면 상태. 백엔드와 약속한 ClientState 는 저장소 어댑터(lib/storage.ts)를 통해서만 읽고 씁니다.
// (지금은 localStorage "handover:v1". 서버 저장으로 바꿀 때는 lib/storage.ts 만 교체)
import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { today } from "./dates";
import { allEvents, EMPTY_EXT_STATE, setExtOverlay, type ExtState } from "./ext";
import { handoverStorage, LOCAL_STATE_KEY, STORAGE_SCOPE } from "./storage";
import { changesWithAdded } from "./data";
import { EMPTY_CLIENT_STATE, type AnyStepId, type ChangeAlert, type ClientState, type CustomStepId, type DateString, type EventCard, type StepState } from "./types";

/** 화면 전용 상태(캐릭터 위치 등). 인수인계 기록이 아니라서 브라우저에만 둔다 */
const EXT_KEY = "handover:ext:v1";

type Ctx = {
  state: ClientState;
  ext: ExtState;
  ready: boolean;
  today: DateString;
  events: EventCard[];
  /** 기본 변경 알림 + "기준 업데이트 확인"에서 추가한 변경 (changesWithAdded). 화면 계산에는 이걸 넘긴다 */
  changes: ChangeAlert[];
  /** 기준 업데이트 확인: 담당자가 후보를 "변경 알림에 추가" */
  addChange: (change: ChangeAlert) => void;
  setStep: (eventId: string, stepId: AnyStepId, st: StepState) => void;
  setEventDate: (eventId: string, date: DateString) => void;
  addNote: (eventId: string, note: string, stepId?: AnyStepId) => void;
  // ---- 체크리스트 직접 편집 ----
  /** 단계 추가 (offsetDays: 행사일 기준, 음수 = 행사 전) */
  addCustomStep: (eventId: string, step: { label: string; offsetDays: number; memo?: string }) => void;
  /** 단계 이름·마감 수정 (템플릿·추가 단계 모두) */
  editStep: (eventId: string, stepId: AnyStepId, patch: { label?: string; offsetDays?: number }) => void;
  /** 이 학교에선 안 하는 단계 숨기기 / 다시 보이기 */
  hideStep: (eventId: string, stepId: AnyStepId) => void;
  unhideStep: (eventId: string, stepId: AnyStepId) => void;
  /** 추가 단계 삭제 (내가 추가한 건 지우고, 카드에 들어 있던 단계는 숨김) */
  removeCustomStep: (eventId: string, stepId: CustomStepId) => void;
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
  const addChange = useCallback<Ctx["addChange"]>((change) =>
    setState((p) => {
      const cur = p.addedChanges ?? [];
      return cur.some((c) => c.id === change.id) ? p : { ...p, addedChanges: [...cur, change] };
    }), []);
  const resetDemo = useCallback<Ctx["resetDemo"]>(() => {
    clearStored();
    setState(EMPTY_CLIENT_STATE);
    setExt(EMPTY_EXT_STATE);
  }, []);
  const toggleConfirm = useCallback<Ctx["toggleConfirm"]>((id) =>
    setState((p) => ({ ...p, confirmedChangeIds: p.confirmedChangeIds.includes(id) ? p.confirmedChangeIds.filter((x) => x !== id) : [...p.confirmedChangeIds, id] })), []);
  const addEvent = useCallback<Ctx["addEvent"]>((card) => setState((p) => ({ ...p, addedEvents: [...p.addedEvents, card] })), []);
  const updateExt = useCallback<Ctx["updateExt"]>((p) => setExt((prev) => ({ ...prev, ...(typeof p === "function" ? p(prev) : p) })), []);

  // ---- 체크리스트 직접 편집 (computeSchedule 이 합쳐서 진행률·캘린더·이번 주 마감에 반영) ----
  const addCustomStep = useCallback<Ctx["addCustomStep"]>((eventId, s) =>
    setState((p) => {
      const id = `custom-${Date.now().toString(36)}` as CustomStepId;
      const step = { id, label: s.label.trim(), offsetDays: Math.round(s.offsetDays), author: "나", ...(s.memo?.trim() ? { memo: s.memo.trim() } : {}) };
      return { ...p, customSteps: { ...p.customSteps, [eventId]: [...(p.customSteps?.[eventId] ?? []), step] } };
    }), []);
  const editStep = useCallback<Ctx["editStep"]>((eventId, stepId, patch) =>
    setState((p) => {
      const cur = p.stepEdits?.[eventId] ?? {};
      return { ...p, stepEdits: { ...p.stepEdits, [eventId]: { ...cur, [stepId]: { ...cur[stepId], ...patch } } } };
    }), []);
  const hideStep = useCallback<Ctx["hideStep"]>((eventId, stepId) =>
    setState((p) => {
      const cur = p.hiddenSteps?.[eventId] ?? [];
      return cur.includes(stepId) ? p : { ...p, hiddenSteps: { ...p.hiddenSteps, [eventId]: [...cur, stepId] } };
    }), []);
  const unhideStep = useCallback<Ctx["unhideStep"]>((eventId, stepId) =>
    setState((p) => ({ ...p, hiddenSteps: { ...p.hiddenSteps, [eventId]: (p.hiddenSteps?.[eventId] ?? []).filter((x) => x !== stepId) } })), []);
  const removeCustomStep = useCallback<Ctx["removeCustomStep"]>((eventId, stepId) =>
    setState((p) => {
      const mine = p.customSteps?.[eventId] ?? [];
      if (mine.some((c) => c.id === stepId)) {
        return { ...p, customSteps: { ...p.customSteps, [eventId]: mine.filter((c) => c.id !== stepId) } };
      }
      // 업로드·전임자가 카드에 넣어 둔 단계는 지울 수 없으니 숨긴다
      const hidden = p.hiddenSteps?.[eventId] ?? [];
      return { ...p, hiddenSteps: { ...p.hiddenSteps, [eventId]: hidden.includes(stepId) ? hidden : [...hidden, stepId] } };
    }), []);

  // 업로드로 추가한 탭 데이터를 getExt·eventBudget·findVenue·getRecord 가 보도록 (렌더 전에 넣는다)
  setExtOverlay(ext);

  const events = useMemo(() => allEvents(state), [state]);
  const changes = useMemo(() => changesWithAdded(state), [state]);
  const value = useMemo(() => ({ state, ext, ready, today: today(), events, changes, addChange, setStep, setEventDate, addNote, addCustomStep, editStep, hideStep, unhideStep, removeCustomStep, toggleConfirm, acknowledgeNote, acceptHandover, resetDemo, addEvent, updateExt }),
    [state, ext, ready, events, changes, addChange, setStep, setEventDate, addNote, addCustomStep, editStep, hideStep, unhideStep, removeCustomStep, toggleConfirm, acknowledgeNote, acceptHandover, resetDemo, addEvent, updateExt]);
  return <C.Provider value={value}>{children}</C.Provider>;
}
export const useApp = () => {
  const v = useContext(C);
  if (!v) throw new Error("AppProvider missing");
  return v;
};
