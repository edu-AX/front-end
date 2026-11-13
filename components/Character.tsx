"use client";
import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useSpring, useTransform, useVelocity } from "framer-motion";

export type CharMode = "idle" | "think";
type Fx = "jump" | "wiggle" | "squish" | null;

/** 오리지널 캐릭터 '아리' — 임시 SVG. 최종 디자인 이미지로 교체 예정 */
function Bird({ mode, fx, walking, dragging }: { mode: CharMode; fx: Fx; walking: boolean; dragging: boolean }) {
  let animation: Record<string, number | number[]> = { y: 0, rotate: 0, scaleX: 1, scaleY: [1, 1.03, 1] };
  let transition: Record<string, unknown> = { scaleY: { duration: 2.4, repeat: Infinity, ease: "easeInOut" } };
  if (dragging) {
    animation = { y: 0, rotate: 0, scaleX: 1.08, scaleY: 1.08 };
    transition = { duration: 0.15 };
  } else if (fx === "jump") {
    animation = { y: [0, -30, 0], rotate: 0, scaleX: 1, scaleY: 1 };
    transition = { duration: 0.5, ease: "easeOut" };
  } else if (fx === "wiggle") {
    animation = { y: 0, rotate: [-12, 12, -10, 10, 0], scaleX: 1, scaleY: 1 };
    transition = { duration: 0.6 };
  } else if (fx === "squish") {
    animation = { y: 0, rotate: 0, scaleX: [1, 1.25, 0.9, 1], scaleY: [1, 0.7, 1.12, 1] };
    transition = { duration: 0.5 };
  } else if (walking) {
    animation = { y: [0, -4, 0], rotate: [-3, 3, -3], scaleX: 1, scaleY: 1 };
    transition = { y: { duration: 0.4, repeat: Infinity }, rotate: { duration: 0.8, repeat: Infinity } };
  } else if (mode === "think") {
    animation = { y: 0, rotate: [-5, 5, -5], scaleX: 1, scaleY: 1 };
    transition = { rotate: { duration: 0.9, repeat: Infinity } };
  }
  const cls = dragging ? "bird dangling" : walking ? "bird walking" : "bird";
  return (
    <motion.svg width="86" height="91" viewBox="0 0 72 76" className={cls}
      style={{ transformOrigin: "50% 100%", overflow: "visible" }} animate={animation} transition={transition}>
      {!dragging && <ellipse cx="36" cy="72" rx="18" ry="3" fill="#00000018" />}
      <g className="leg leg-a"><line x1="29" y1="62" x2="29" y2="72" stroke="#FF9A3C" strokeWidth="3.5" strokeLinecap="round" /></g>
      <g className="leg leg-b"><line x1="43" y1="62" x2="43" y2="72" stroke="#FF9A3C" strokeWidth="3.5" strokeLinecap="round" /></g>
      <ellipse cx="36" cy="40" rx="26" ry="24" fill="#FFD66B" />
      <ellipse cx="36" cy="46" rx="16" ry="13" fill="#FFF0B8" />
      <path d="M30 17 q6 -12 12 0 q-6 -4 -12 0z" fill="#FFB84A" />
      {dragging ? (
        <g><circle cx="27" cy="34" r="4.2" fill="#3b3a36" /><circle cx="45" cy="34" r="4.2" fill="#3b3a36" /><circle cx="28.3" cy="32.6" r="1.4" fill="#fff" /><circle cx="46.3" cy="32.6" r="1.4" fill="#fff" /></g>
      ) : (
        <g className="blink"><circle cx="27" cy="34" r="3.2" fill="#3b3a36" /><circle cx="45" cy="34" r="3.2" fill="#3b3a36" /><circle cx="28" cy="33" r="1" fill="#fff" /><circle cx="46" cy="33" r="1" fill="#fff" /></g>
      )}
      {dragging ? <ellipse cx="36" cy="46" rx="3" ry="4" fill="#FF9A3C" /> : <path d="M32 40 l4 5 l4 -5z" fill="#FF9A3C" />}
      <circle cx="21" cy="42" r="3.5" fill="#FFADAD" opacity=".7" /><circle cx="51" cy="42" r="3.5" fill="#FFADAD" opacity=".7" />
      <motion.path d="M12 42 q-8 6 -2 14 q8 -2 8 -12z" fill="#FFC94D" style={{ transformOrigin: "14px 44px" }}
        animate={dragging ? { rotate: [-30, 12, -30] } : walking ? { rotate: [8, -14, 8] } : { rotate: 0 }} transition={{ duration: dragging ? 0.3 : 0.4, repeat: dragging || walking ? Infinity : 0 }} />
      <motion.path d="M60 42 q8 6 2 14 q-8 -2 -8 -12z" fill="#FFC94D" style={{ transformOrigin: "58px 44px" }}
        animate={dragging ? { rotate: [30, -12, 30] } : { rotate: 0 }} transition={{ duration: 0.3, repeat: dragging ? Infinity : 0 }} />
    </motion.svg>
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const REACTIONS: { text: string; fx: Fx; hearts?: boolean }[] = [
  { text: "선생님, 오늘도 정말 고생 많으세요 💛", fx: "jump", hearts: true },
  { text: "선생님 덕분에 아이들이 쑥쑥 자라요 🌱", fx: "wiggle" },
  { text: "파이팅! 선생님은 충분히 잘하고 계세요 💪", fx: "jump" },
  { text: "처음이라 헷갈려도 괜찮아요, 아리가 옆에 있어요!", fx: "squish" },
  { text: "한 단계씩 하면 돼요. 하나씩 같이 해봐요 🐥", fx: "wiggle" },
  { text: "선생님이 최고예요! ⭐", fx: "jump", hearts: true },
  { text: "잠깐 물 한 잔 마시고 가요 🥤", fx: "squish" },
  { text: "오늘 하루도 무사히, 무탈하게! 🍀", fx: "wiggle" },
  { text: "행사 준비하느라 애쓰셨어요 👏", fx: "jump" },
  { text: "선생님의 노력, 아이들이 다 알고 있어요 💛", fx: "jump", hearts: true },
  { text: "어려운 일도 선생님이라면 해내실 거예요!", fx: "wiggle" },
  { text: "수고했어요, 선생님! 오늘도 멋져요 ✨", fx: "squish" },
  { text: "힘들 땐 아리를 불러요. 응원할게요 📣", fx: "jump" },
  { text: "선생님 오늘도 화이팅이에요! 🔥", fx: "wiggle" },
  { text: "잘하고 있어요. 정말로요 😊", fx: "squish", hearts: true },
];

export default function Character({ mode, alert, greeting, notice, pos, onPos, onChat, onHide }: {
  mode: CharMode; alert: boolean; greeting?: string | null;
  /** 한 번 띄울 알림 말풍선 (id 가 바뀔 때마다 한 번) */
  notice?: { id: number; text: string } | null;
  pos: { x: number; y: number } | null;
  onPos: (p: { x: number; y: number }) => void; onChat: () => void; onHide: () => void;
}) {
  const x = useMotionValue(pos?.x ?? 40);
  const y = useMotionValue(pos?.y ?? 0);
  const tilt = useSpring(useTransform(useVelocity(x), [-900, 0, 900], [-20, 0, 20]), { stiffness: 180, damping: 14 });
  const tiltY = useSpring(useTransform(useVelocity(y), [-900, 0, 900], [-8, 0, 8]), { stiffness: 180, damping: 14 });
  const swing = useTransform([tilt, tiltY], ([a, b]) => (a as number) + (b as number));

  const [bubble, setBubble] = useState<string | null>(null);
  const [fx, setFx] = useState<Fx>(null);
  const [hearts, setHearts] = useState(0);
  const [alignRight, setAlignRight] = useState(false);
  const [flip, setFlip] = useState(false);
  const [walking, setWalking] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(false);
  const moved = useRef(false);
  const busy = useRef(false);
  const run = useRef<{ stop: () => void } | null>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const idx = useRef(0);
  busy.current = mode === "think";

  const say = (text: string, ms = 1800) => {
    setAlignRight(x.get() > window.innerWidth / 2);
    setBubble(text);
    clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setBubble(null), ms);
  };
  const play = (f: Fx, ms = 650) => { setFx(f); setTimeout(() => setFx(null), ms); };

  useEffect(() => {
    let alive = true;
    (async () => {
      while (alive) {
        await sleep(1800 + Math.random() * 3200);
        if (!alive) break;
        if (dragRef.current || busy.current) continue;
        if (Math.random() < 0.4) { setFlip((f) => !f); await sleep(700); setFlip((f) => !f); await sleep(500); if (!alive || dragRef.current) continue; }
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
    return () => { alive = false; run.current?.stop(); clearTimeout(clickTimer.current); clearTimeout(bubbleTimer.current); };
  }, [x]);

  const stopWalk = () => { run.current?.stop(); setWalking(false); };

  // 처음 나타나면 "수학여행 D-62예요!" 처럼 가장 가까운 행사를 먼저 알려준다
  const greeted = useRef(false);
  useEffect(() => {
    if (!greeting || greeted.current) return;
    greeted.current = true;
    const t = setTimeout(() => { play("jump", 500); say(greeting, 4000); }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [greeting]);

  // 기준 업데이트 확인에서 변경을 추가하면 "새 기준 변경이 있어요" 를 한 번 말한다
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => { stopWalk(); play("jump", 500); say(notice.text, 4000); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notice?.id]);

  const onSingleClick = () => {
    stopWalk();
    let n = Math.floor(Math.random() * REACTIONS.length);
    if (n === idx.current) n = (n + 1) % REACTIONS.length; // 같은 말이 연속으로 나오지 않게
    idx.current = n;
    const r = REACTIONS[n];
    say(r.text, 2600); play(r.fx);
    if (r.hearts) setHearts((n) => n + 1);
  };

  return (
    <motion.div drag dragMomentum={false} dragElastic={0} style={{ x, y, position: "fixed", left: 0, bottom: 16, zIndex: 30, touchAction: "none" }}
      title="클릭: 인사 · 더블클릭: 대화 · 드래그: 옮기기"
      onDragStart={() => { dragRef.current = true; moved.current = false; stopWalk(); setDragging(true); say("우와~ 🎈", 1200); }}
      onDrag={() => { moved.current = true; }}
      onDragEnd={() => { dragRef.current = false; setDragging(false); onPos({ x: x.get(), y: y.get() }); play("squish", 500); say("여기가 좋아요!", 1200); }}
      onClick={() => {
        if (moved.current) { moved.current = false; return; }
        if (clickTimer.current) return;
        clickTimer.current = setTimeout(() => { clickTimer.current = undefined; onSingleClick(); }, 260);
      }}
      onDoubleClick={() => {
        clearTimeout(clickTimer.current); clickTimer.current = undefined;
        stopWalk(); say("네, 말씀하세요!", 1200); play("jump", 500);
        onChat();
      }}
      className="cursor-grab select-none active:cursor-grabbing">
      {(bubble || alert) && (
        <div className={`absolute bottom-full mb-2 w-max max-w-[230px] rounded-2xl bg-white px-3 py-1.5 text-xs font-semibold leading-snug shadow ${alignRight ? "right-0 text-right" : "left-0"}`}>
          {bubble ?? "❗ 확인할 변경 알림이 있어요"}
        </div>
      )}
      {mode === "think" && <div className="absolute -top-6 left-1/2 -translate-x-1/2 rounded-full bg-white px-2 text-sm shadow">···</div>}
      {hearts > 0 && [0, 1, 2].map((i) => (
        <motion.span key={`${hearts}-${i}`} className="pointer-events-none absolute left-1/2 top-2 text-sm" initial={{ opacity: 1, y: 0, x: (i - 1) * 14 }}
          animate={{ opacity: 0, y: -50 - i * 8, x: (i - 1) * 24 }} transition={{ duration: 1.1, delay: i * 0.12 }}>💛</motion.span>
      ))}
      <div style={{ transform: flip ? "scaleX(-1)" : undefined, transition: "transform .25s" }}>
        <motion.div style={{ rotate: dragging ? swing : 0, transformOrigin: "50% 12%" }}>
          <Bird mode={mode} fx={fx} walking={walking} dragging={dragging} />
        </motion.div>
      </div>
      <button onClick={(e) => { e.stopPropagation(); onHide(); }} onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}
        className="absolute -right-2 -top-1 rounded-full bg-white/90 px-1.5 text-[10px] text-stone-500 shadow hover:bg-white">숨기기</button>
    </motion.div>
  );
}
