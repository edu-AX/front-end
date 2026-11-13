"use client";
import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue } from "framer-motion";

export type CharMode = "idle" | "think";

/** 오리지널 캐릭터 '한빛이' — 임시 SVG. 최종 디자인 이미지로 교체 예정 */
function Bird({ mode, jump, walking }: { mode: CharMode; jump: boolean; walking: boolean }) {
  const animation = jump
    ? { y: [0, -28, 0], rotate: 0, scaleY: 1 }
    : walking
      ? { y: [0, -4, 0], rotate: [-3, 3, -3], scaleY: 1 }
      : mode === "think"
        ? { y: 0, rotate: [-5, 5, -5], scaleY: 1 }
        : { y: 0, rotate: 0, scaleY: [1, 1.03, 1] };
  const transition = jump
    ? { duration: 0.5, ease: "easeOut" as const }
    : walking
      ? { y: { duration: 0.4, repeat: Infinity }, rotate: { duration: 0.8, repeat: Infinity } }
      : mode === "think"
        ? { rotate: { duration: 0.9, repeat: Infinity } }
        : { scaleY: { duration: 2.4, repeat: Infinity, ease: "easeInOut" as const } };

  return (
    <motion.svg width="72" height="76" viewBox="0 0 72 76" className={walking ? "bird walking" : "bird"}
      style={{ transformOrigin: "50% 100%", overflow: "visible" }} animate={animation} transition={transition}>
      <ellipse cx="36" cy="72" rx="18" ry="3" fill="#00000018" />
      <g className="leg leg-a"><line x1="29" y1="62" x2="29" y2="72" stroke="#FF9A3C" strokeWidth="3.5" strokeLinecap="round" /></g>
      <g className="leg leg-b"><line x1="43" y1="62" x2="43" y2="72" stroke="#FF9A3C" strokeWidth="3.5" strokeLinecap="round" /></g>
      <ellipse cx="36" cy="40" rx="26" ry="24" fill="#FFD66B" />
      <ellipse cx="36" cy="46" rx="16" ry="13" fill="#FFF0B8" />
      <path d="M30 17 q6 -12 12 0 q-6 -4 -12 0z" fill="#FFB84A" />
      <g className="blink"><circle cx="27" cy="34" r="3.2" fill="#3b3a36" /><circle cx="45" cy="34" r="3.2" fill="#3b3a36" /></g>
      <circle cx="28" cy="33" r="1" fill="#fff" /><circle cx="46" cy="33" r="1" fill="#fff" />
      <path d="M32 40 l4 5 l4 -5z" fill="#FF9A3C" />
      <circle cx="21" cy="42" r="3.5" fill="#FFADAD" opacity=".7" /><circle cx="51" cy="42" r="3.5" fill="#FFADAD" opacity=".7" />
      <motion.path d="M12 42 q-8 6 -2 14 q8 -2 8 -12z" fill="#FFC94D" style={{ transformOrigin: "14px 44px" }}
        animate={walking ? { rotate: [8, -14, 8] } : { rotate: 0 }} transition={{ duration: 0.4, repeat: walking ? Infinity : 0 }} />
    </motion.svg>
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Character({ mode, alert, pos, onPos, onClick, onHide }: {
  mode: CharMode; alert: boolean; pos: { x: number; y: number } | null;
  onPos: (p: { x: number; y: number }) => void; onClick: () => void; onHide: () => void;
}) {
  const x = useMotionValue(pos?.x ?? 40);
  const y = useMotionValue(pos?.y ?? 0);
  const [bubble, setBubble] = useState<string | null>(null);
  const [jump, setJump] = useState(false);
  const [flip, setFlip] = useState(false);
  const [walking, setWalking] = useState(false);
  const dragging = useRef(false);
  const moved = useRef(false);
  const busy = useRef(false);
  const run = useRef<{ stop: () => void } | null>(null);
  busy.current = mode === "think";

  useEffect(() => {
    let alive = true;
    (async () => {
      while (alive) {
        // 서서 쉬는 시간(가끔 두리번거림)
        await sleep(1800 + Math.random() * 3200);
        if (!alive) break;
        if (dragging.current || busy.current) continue;
        if (Math.random() < 0.4) { setFlip((f) => !f); await sleep(700); setFlip((f) => !f); await sleep(500); if (!alive || dragging.current) continue; }
        // 일정한 속도로 걷기
        const max = Math.max(120, window.innerWidth - 110);
        const dir = Math.random() < 0.5 ? -1 : 1;
        const target = Math.min(max, Math.max(10, x.get() + dir * (90 + Math.random() * 280)));
        const dist = Math.abs(target - x.get());
        if (dist < 30) continue;
        setFlip(target < x.get());
        setWalking(true);
        const ctl = animate(x, target, { duration: dist / 55, ease: "linear" });
        run.current = ctl;
        try { await ctl; } catch {}
        setWalking(false);
      }
    })();
    return () => { alive = false; run.current?.stop(); };
  }, [x]);

  return (
    <motion.div drag dragMomentum={false} style={{ x, y, position: "fixed", left: 0, bottom: 16, zIndex: 30, touchAction: "none" }}
      onDragStart={() => { dragging.current = true; moved.current = false; run.current?.stop(); setWalking(false); }}
      onDrag={() => { moved.current = true; }}
      onDragEnd={() => { dragging.current = false; onPos({ x: x.get(), y: y.get() }); }}
      onClick={() => {
        if (moved.current) { moved.current = false; return; }
        run.current?.stop(); setWalking(false);
        setJump(true); setBubble("뭐가 궁금하세요?");
        setTimeout(() => { setJump(false); setBubble(null); }, 1500);
        onClick();
      }}
      className="cursor-grab select-none active:cursor-grabbing">
      {(bubble || alert) && (
        <div className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-3 py-1 text-xs font-semibold shadow">
          {bubble ?? "❗ 확인할 변경 알림이 있어요"}
        </div>
      )}
      {mode === "think" && <div className="absolute -top-6 left-1/2 -translate-x-1/2 rounded-full bg-white px-2 text-sm shadow">···</div>}
      <div style={{ transform: flip ? "scaleX(-1)" : undefined, transition: "transform .25s" }}><Bird mode={mode} jump={jump} walking={walking} /></div>
      <button onClick={(e) => { e.stopPropagation(); onHide(); }} onPointerDown={(e) => e.stopPropagation()}
        className="absolute -right-2 -top-1 rounded-full bg-white/90 px-1.5 text-[10px] text-stone-500 shadow hover:bg-white">숨기기</button>
    </motion.div>
  );
}
