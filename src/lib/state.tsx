"use client";
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import type { Persist } from "./data";

const empty: Persist = { done: {}, dates: {}, confirmed: {}, notes: {}, charPos: null, hidden: false };
const KEY = "edu-ax-handover-v1";
type Ctx = { s: Persist; update: (p: Partial<Persist> | ((s: Persist) => Partial<Persist>)) => void; ready: boolean };
const C = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<Persist>(empty);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { const r = localStorage.getItem(KEY); if (r) setS({ ...empty, ...JSON.parse(r) }); } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
  }, [s, ready]);
  const update = useCallback<Ctx["update"]>((p) => setS((prev) => ({ ...prev, ...(typeof p === "function" ? p(prev) : p) })), []);
  return <C.Provider value={{ s, update, ready }}>{children}</C.Provider>;
}
export const useApp = () => {
  const v = useContext(C);
  if (!v) throw new Error("AppProvider missing");
  return v;
};
