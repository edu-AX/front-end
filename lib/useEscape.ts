"use client";
// Esc 키로 창(모달·드로어)을 닫는다. 가장 나중에 열린 창 하나만 반응한다.
import { useEffect, useRef } from "react";

const stack: number[] = [];
let seq = 0;

export function useEscape(onEscape: () => void, active = true) {
  const handler = useRef(onEscape);
  handler.current = onEscape;

  useEffect(() => {
    if (!active) return;
    const id = ++seq;
    stack.push(id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || stack[stack.length - 1] !== id) return;
      // 입력 중인 한글 조합(IME)을 끝내는 Esc 는 무시
      if (e.isComposing) return;
      e.preventDefault();
      handler.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      const i = stack.indexOf(id);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [active]);
}
