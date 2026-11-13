"use client";
// 모달·드로어가 열려 있는 동안 뒤의 메인 페이지가 스크롤되지 않게 막는다.
// 여러 개가 동시에 열려도(인수인계 화면 → 행사 카드) 마지막 하나가 닫힐 때만 풀린다.
import { useEffect } from "react";

let locks = 0;
let prevOverflow = "";

export function useLockBodyScroll(active = true) {
  useEffect(() => {
    if (!active) return;
    const body = document.body;
    if (locks === 0) {
      prevOverflow = body.style.overflow;
      body.style.overflow = "hidden";
    }
    locks += 1;
    return () => {
      locks -= 1;
      if (locks === 0) body.style.overflow = prevOverflow;
    };
  }, [active]);
}
