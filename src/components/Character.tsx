"use client";
import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue } from "framer-motion";

export type CharMode = "idle" | "think";

/** 오리지널 캐릭터 '한빛이' — 임시 SVG. 최종 디자인 이미지로 교체 예정 */
function Bird({ mode, jump }: { mode: CharMode; jump: boolean }) {
  return (
    <motion.svg width="72" height="72" viewBox="0 0 72 72" animate={jump ? { y: [0, -26, 0] } : mode === "think" ? { rotate: [-4, 4, -4] } : { y: [0, -3, 0] }}
      transition={{ duration: jump ? 0.45 : 0.8, repeat: jump ? 0 : Infinity }}>
      <ellipse cx="36" cy="64" rx="18" ry="3" fill="#00000018" />
      <ellipse cx="36" cy="40" rx="26" ry="24" fill="#FFD66B" />
      <ellipse cx="36" cy="46" rx="16" ry="13" fill="#FFF0B8" />
      <path d="M30 17 q6 -12 12 0 q-6 -4 -12 0z" fill="#FFB84A" />
      <circle cx="27" cy="34" r="3.2" fill="#3b3a36" /><circle cx="45" cy="34" r="3.2" fill="#3b3a36" />
      <circle cx="28" cy="33" r="1" fill="#fff" /><circle cx="46" cy="33" r="1" fill="#fff" />
      <path d="M32 40 l4 5 l4 -5z" fill="#FF9A3C" />
      <circle cx="21" cy="42" r="3.5" fill="#FFADAD" opacity=".7" /><circle cx="51" cy="42" r="3.5" fill="#FFADAD" opacity=".7" />
      <path d="M28 62 v4 M44 62 v4" stroke="#FF9A3C" strokeWidth="3" strokeLinecap="round" />
    </motion.svg>
  );
}

export default function Character({ mode, alert, pos, onPos, onClick, onHide }: {
  mode: CharMode; alert: boolean; pos: { x: number; y: number } | null;
  onPos: (p: { x: number; y: number }) => void; onClick: () => void; onHide: () => void;
}) {
  const x = useMotionValue(pos?.x ?? 40);
  const y = useMotionValue(pos?.y ?? 0);
  const [bubble, setBubble] = useState<string | null>(null);
  const [jump, setJump] = useState(false);
  const [flip, setFlip] = useState(false);
  const dragging = useRef(false);
  const moved = useRef(false);
  const busy = useRef(false);
  busy.current = mode === "think";

  useEffect(() => {
    const t = setInterval(() => {
      if (dragging.current || busy.current) return;
      const target = 20 + Math.random() * Math.max(200, window.innerWidth - 160);
      setFlip(target < x.get());
      animate(x, target, { duration: 3 + Math.random() * 2, ease: "easeInOut" });
    }, 6000);
    return () => clearInterval(t);
  }, [x]);

  return (
    <>
      <motion.div drag dragMomentum={false} style={{ x, y, position: "fixed", left: 0, bottom: 16, zIndex: 30, touchAction: "none" }}
        onDragStart={() => { dragging.current = true; moved.current = false; x.stop(); }}
        onDrag={() => { moved.current = true; }}
        onDragEnd={() => { dragging.current = false; onPos({ x: x.get(), y: y.get() }); }}
        onClick={() => { if (moved.current) { moved.current = false; return; } setJump(true); setBubble("뭐가 궁금하세요?"); setTimeout(() => { setJump(false); setBubble(null); }, 1500); onClick(); }}
        className="cursor-grab select-none active:cursor-grabbing">
        {(bubble || alert) && (
          <div className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-3 py-1 text-xs font-semibold shadow">
            {bubble ?? "❗ 확인할 변경 알림이 있어요"}
          </div>
        )}
        {mode === "think" && <div className="absolute -top-6 left-1/2 -translate-x-1/2 rounded-full bg-white px-2 text-sm shadow">···</div>}
        <div style={{ transform: flip ? "scaleX(-1)" : undefined }}><Bird mode={mode} jump={jump} /></div>
        <button onClick={(e) => { e.stopPropagation(); onHide(); }} onPointerDown={(e) => e.stopPropagation()}
          className="absolute -right-2 -top-1 rounded-full bg-white/90 px-1.5 text-[10px] text-stone-500 shadow hover:bg-white">숨기기</button>
      </motion.div>
    </>
  );
}
