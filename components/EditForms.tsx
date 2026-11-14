"use client";
// 담당자가 직접 고치는 입력 폼들 (예산·장소·담당 이력·참가 인원/교육청 기준).
// 고친 값은 ext.edits 에 저장돼 원본 데이터 위에 덮여 보인다 (lib/ext.ts).
import { useState } from "react";
import { editedAt, setEdit, won, type Budget, type Owner, type Venue } from "@/lib/ext";
import { maskPersonalInfo } from "@/lib/masking";
import { useApp } from "@/lib/state";
import { mmdd } from "@/lib/dates-view";
import type { EventCard } from "@/lib/types";

const input = "h-10 w-full rounded-full border border-stone-200 bg-white px-4 text-sm";
const area = "w-full rounded-2xl border border-stone-200 bg-white p-3 text-sm";
const num = (s: string) => Math.max(0, Math.round(Number(String(s).replace(/[,\s원]/g, "")) || 0));

/** 탭 위쪽의 "고치기 / 수정됨 · 원래대로" 줄 */
export function EditBar({ kind, id, editing, onEdit, label = "고치기" }: { kind: string; id: string; editing: boolean; onEdit: () => void; label?: string }) {
  const { ext, today, updateExt } = useApp();
  const at = editedAt(ext.edits, kind, id);
  const reset = () => updateExt((p) => setEdit(p, kind as "budgets", id, null, today));
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
      {at && <span className="rounded-full bg-sky-100 px-2.5 py-1 font-bold text-sky-800">수정됨 · {mmdd(at)}</span>}
      {at && !editing && <button onClick={reset} className="rounded-full bg-white px-3 py-1.5 text-stone-500 shadow-sm hover:bg-stone-50">원래 값으로</button>}
      {!editing && <button onClick={onEdit} className="rounded-full bg-white px-4 py-1.5 text-sm font-bold text-stone-700 shadow-sm hover:bg-stone-50">✏️ {label}</button>}
    </div>
  );
}

const Buttons = ({ onSave, onCancel, disabled }: { onSave: () => void; onCancel: () => void; disabled?: boolean }) => (
  <div className="flex justify-end gap-2 pt-1">
    <button type="button" onClick={onCancel} className="h-10 rounded-full bg-stone-100 px-5 text-sm">취소</button>
    <button type="button" onClick={onSave} disabled={disabled} className="h-10 rounded-full bg-amber-400 px-5 text-sm font-bold disabled:opacity-40">저장</button>
  </div>
);

// ---------------------------------------------------------------- 예산
export function BudgetEditor({ ev, b, onClose }: { ev: EventCard; b: Budget; onClose: () => void }) {
  const { today, updateExt } = useApp();
  const [src, setSrc] = useState(b.sources.map((s) => ({ ...s, planned: s.amountUnknown ? "" : String(s.planned), spent: s.amountUnknown ? "" : String(s.spent), per: s.perStudent ? String(s.perStudent) : "" })));
  const [items, setItems] = useState(b.items.map((i) => ({ ...i, planned: i.amountUnknown ? "" : String(i.planned) })));

  const plannedSum = src.reduce((n, s) => n + num(s.planned), 0);
  const itemSum = items.reduce((n, i) => n + num(i.planned), 0);
  const payerIdx = src.findIndex((s) => num(s.per) > 0);
  const expected = payerIdx >= 0 && ev.participants ? num(src[payerIdx].per) * ev.participants : 0;

  const warns: { text: string; red?: boolean }[] = [];
  if (items.length && itemSum !== plannedSum) warns.push({ text: `항목 합계(${won(itemSum)})와 재원 합계(${won(plannedSum)})가 ${won(Math.abs(itemSum - plannedSum))} 달라요.` });
  if (payerIdx >= 0 && expected && num(src[payerIdx].planned) !== expected)
    warns.push({ text: `1인당 ${num(src[payerIdx].per).toLocaleString()}원 × ${ev.participants}명 = ${won(expected)} 인데 수익자부담 편성은 ${won(num(src[payerIdx].planned))}예요.` });
  src.forEach((s) => {
    if (num(s.spent) > num(s.planned)) warns.push({ red: true, text: `${s.type}: 편성보다 ${won(num(s.spent) - num(s.planned))} 더 썼어요.${s.transferable ? "" : " 이·전용 불가 재원이라 다른 재원에서 메꿀 수 없어요."}` });
  });

  const save = () => {
    const sources = src.map(({ per, planned, spent, amountUnknown: _u, ...s }) => { void _u; return { ...s, planned: num(planned), spent: num(spent), ...(num(per) ? { perStudent: num(per) } : {}) }; });
    const its = items.map(({ amountUnknown: _u, planned, ...i }) => { void _u; return { ...i, planned: num(planned) }; });
    updateExt((p) => setEdit(p, "budgets", b.id, { sources, items: its }, today));
    onClose();
  };

  return (
    <div className="space-y-3 rounded-2xl bg-white p-4 text-sm shadow-sm">
      <div className="font-bold">예산 고치기 <span className="text-xs font-normal text-stone-400">(원 단위로 입력)</span></div>
      <div className="space-y-3">
        {src.map((s, i) => (
          <div key={s.type} className="rounded-xl bg-stone-50 p-3">
            <div className="mb-2 text-xs font-bold text-stone-600">{s.type}{!s.transferable && <span className="ml-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] text-red-600">이·전용 불가</span>}</div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-stone-500">편성액<input className={input} inputMode="numeric" value={s.planned} onChange={(e) => setSrc(src.map((x, j) => (j === i ? { ...x, planned: e.target.value } : x)))} />
                <span className="mt-0.5 block text-[11px] text-stone-400">{s.planned ? won(num(s.planned)) : ""}</span></label>
              <label className="text-xs text-stone-500">집행액<input className={input} inputMode="numeric" value={s.spent} onChange={(e) => setSrc(src.map((x, j) => (j === i ? { ...x, spent: e.target.value } : x)))} />
                <span className="mt-0.5 block text-[11px] text-stone-400">{s.spent ? won(num(s.spent)) : ""}</span></label>
            </div>
            {(s.per || s.type.includes("수익자")) && (
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <label className="min-w-[160px] flex-1 text-xs text-stone-500">1인당 경비<input className={input} inputMode="numeric" value={s.per} onChange={(e) => setSrc(src.map((x, j) => (j === i ? { ...x, per: e.target.value } : x)))} /></label>
                {ev.participants && num(s.per) > 0 && (
                  <button type="button" onClick={() => setSrc(src.map((x, j) => (j === i ? { ...x, planned: String(num(x.per) * ev.participants!) } : x)))}
                    className="h-10 rounded-full bg-amber-100 px-4 text-xs font-bold text-amber-800">1인당 × {ev.participants}명으로 편성 맞추기</button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {items.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-bold text-stone-500">지출 항목(편성)</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {items.map((it, i) => (
              <label key={it.name} className="text-xs text-stone-500">{it.name}
                <input className={input} inputMode="numeric" value={it.planned} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, planned: e.target.value } : x)))} /></label>
            ))}
          </div>
        </div>
      )}
      {warns.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-orange-50 p-3 text-xs">
          {warns.map((w, i) => <li key={i} className={w.red ? "font-bold text-red-600" : "text-orange-700"}>⚠ {w.text}</li>)}
        </ul>
      )}
      <p className="text-[11px] text-stone-400">경고가 있어도 저장할 수 있어요. 실제 집행·결재는 학교회계 시스템에서 해요.</p>
      <Buttons onSave={save} onCancel={onClose} />
    </div>
  );
}

// ---------------------------------------------------------------- 장소
export function VenueEditor({ ev, v, onClose }: { ev: EventCard; v: Venue; onClose: () => void }) {
  const { today, updateExt } = useApp();
  const [year, setYear] = useState(v.lastInspectionYear ? String(v.lastInspectionYear) : "");
  const [travel, setTravel] = useState(v.travelMinutes ? String(v.travelMinutes) : "");
  const [cap, setCap] = useState(v.capacity ? String(v.capacity) : "");
  const [bus, setBus] = useState(v.busParking);
  const [hospital, setHospital] = useState(v.emergency.hospital);
  const [checks, setChecks] = useState(v.safetyChecks.map((c) => ({ ...c })));
  const [memo, setMemo] = useState("");
  const [rating, setRating] = useState("4");
  const masked = memo.trim() ? maskPersonalInfo(memo) : null;
  const pii = masked && masked.maskCount > 0;

  const save = () => {
    const history = [...v.history];
    const text = (pii ? masked!.maskedText : memo).trim();
    if (text) history.push({ year: Number(today.slice(0, 4)), eventId: ev.id, rating: Number(rating), memo: text });
    updateExt((p) => setEdit(p, "venues", v.id, {
      lastInspectionYear: num(year), travelMinutes: num(travel), capacity: num(cap), busParking: bus,
      emergency: { ...v.emergency, hospital }, safetyChecks: checks, history,
    }, today));
    onClose();
  };

  return (
    <div className="space-y-3 rounded-2xl bg-white p-4 text-sm shadow-sm">
      <div className="font-bold">{v.name} 고치기</div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-stone-500">마지막 점검 연도<input className={input} inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} placeholder="예: 2026" /></label>
        <label className="text-xs text-stone-500">학교에서 이동 시간(분)<input className={input} inputMode="numeric" value={travel} onChange={(e) => setTravel(e.target.value)} /></label>
        <label className="text-xs text-stone-500">수용 인원(명)<input className={input} inputMode="numeric" value={cap} onChange={(e) => setCap(e.target.value)} /></label>
        <label className="text-xs text-stone-500">버스 주차<input className={input} value={bus} onChange={(e) => setBus(e.target.value)} /></label>
      </div>
      <label className="block text-xs text-stone-500">가까운 응급실<input className={input} value={hospital} onChange={(e) => setHospital(e.target.value)} /></label>
      {checks.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-bold text-stone-500">안전 확인 결과</div>
          <div className="space-y-2">
            {checks.map((c, i) => (
              <div key={c.item} className="rounded-xl bg-stone-50 p-2">
                <div className="mb-1 text-xs text-stone-600">{c.item}</div>
                <div className="grid grid-cols-2 gap-2">
                  <input className={input} value={c.result} aria-label={`${c.item} 결과`} onChange={(e) => setChecks(checks.map((x, j) => (j === i ? { ...x, result: e.target.value } : x)))} />
                  <input type="date" className={input} value={/^\d{4}-\d{2}-\d{2}$/.test(c.checkedAt) ? c.checkedAt : ""} aria-label={`${c.item} 확인일`} onChange={(e) => setChecks(checks.map((x, j) => (j === i ? { ...x, checkedAt: e.target.value } : x)))} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="rounded-xl bg-yellow-50 p-3">
        <div className="mb-1 text-xs font-bold text-stone-600">올해({today.slice(0, 4)}) 이용 메모 추가</div>
        <textarea className={`${area} h-16`} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예: 강당 음향이 약했음, 마이크 지참 (학생 이름·연락처는 적지 마세요)" />
        <div className="mt-1 flex items-center gap-2 text-xs text-stone-500">만족도
          <select className="h-9 rounded-full border border-stone-200 bg-white px-3" value={rating} onChange={(e) => setRating(e.target.value)}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}</select>
          {pii && <span className="font-bold text-red-600">개인정보로 보이는 글은 ○○○로 가려서 저장돼요</span>}
        </div>
      </div>
      <Buttons onSave={save} onCancel={onClose} />
    </div>
  );
}

// ---------------------------------------------------------------- 담당 이력
export function OwnerEditor({ ev, list, onClose }: { ev: EventCard; list: Owner[]; onClose: () => void }) {
  const { today, updateExt } = useApp();
  const year = Number(today.slice(0, 4));
  const blank = (): Owner => ({ year, role: "주담당", name: null, consentToShow: false, contact: null, notes: { good: "", problem: "", nextYear: "" } });
  const [rows, setRows] = useState<Owner[]>(list.some((o) => o.year === year) ? list.map((o) => ({ ...o, notes: { ...o.notes } })) : [blank(), ...list.map((o) => ({ ...o, notes: { ...o.notes } }))]);
  const setNote = (i: number, k: keyof Owner["notes"], v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, notes: { ...r.notes, [k]: v } } : r)));
  const all = rows.flatMap((r) => Object.values(r.notes)).join("\n");
  const pii = maskPersonalInfo(all).maskCount;

  const save = () => {
    const cleaned = rows
      .map((r) => ({ ...r, notes: { good: maskPersonalInfo(r.notes.good).maskedText, problem: maskPersonalInfo(r.notes.problem).maskedText, nextYear: maskPersonalInfo(r.notes.nextYear).maskedText } }))
      .filter((r) => Object.values(r.notes).some((t) => t.trim()));
    updateExt((p) => setEdit(p, "owners", ev.id, cleaned, today));
    onClose();
  };

  return (
    <div className="space-y-3 text-sm">
      {rows.map((r, i) => (
        <div key={`${r.year}-${i}`} className="space-y-2 rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <b>{r.year}</b>
            <input className={`${input} max-w-[140px]`} value={r.role} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))} aria-label="역할" />
            <span className="text-xs text-stone-400">{r.consentToShow && r.name ? `${r.name} 선생님` : "담당(비공개)"}</span>
          </div>
          <label className="block text-xs font-bold text-emerald-700">잘된 점<textarea className={`${area} mt-1 h-16 font-normal`} value={r.notes.good} onChange={(e) => setNote(i, "good", e.target.value)} /></label>
          <label className="block text-xs font-bold text-orange-700">문제였던 점<textarea className={`${area} mt-1 h-16 font-normal`} value={r.notes.problem} onChange={(e) => setNote(i, "problem", e.target.value)} /></label>
          <label className="block text-xs font-bold text-sky-700">내년엔 이렇게<textarea className={`${area} mt-1 h-16 font-normal`} value={r.notes.nextYear} onChange={(e) => setNote(i, "nextYear", e.target.value)} /></label>
        </div>
      ))}
      {pii > 0 && <p className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-600">개인정보로 보이는 글이 {pii}곳 있어요. 저장하면 ○○○로 가려져요. 학생 이름·연락처는 적지 마세요.</p>}
      <Buttons onSave={save} onCancel={onClose} />
    </div>
  );
}

// ---------------------------------------------------------------- 참가 인원 · 교육청 기준
export function FactsEditor({ ev, onClose }: { ev: EventCard; onClose: () => void }) {
  const { today, updateExt } = useApp();
  const [people, setPeople] = useState(ev.participants ? String(ev.participants) : "");
  const [consent, setConsent] = useState(ev.officeRules?.consentRate ?? "");
  const [staff, setStaff] = useState(ev.officeRules?.safetyStaff ?? "");
  const save = () => {
    updateExt((p) => setEdit(p, "facts", ev.id, { participants: num(people) || undefined, ...(ev.officeRules ? { consentRate: consent, safetyStaff: staff } : {}) }, today));
    onClose();
  };
  return (
    <div className="space-y-2 rounded-2xl bg-white p-4 text-sm shadow-sm">
      <div className="font-bold">참가 인원·교육청 기준 고치기</div>
      <label className="block text-xs text-stone-500">참가 인원(명)<input className={input} inputMode="numeric" value={people} onChange={(e) => setPeople(e.target.value)} /></label>
      {ev.officeRules && (<>
        <label className="block text-xs text-stone-500">동의율 기준 ({ev.officeRules.office})<input className={input} value={consent} onChange={(e) => setConsent(e.target.value)} /></label>
        <label className="block text-xs text-stone-500">안전요원 기준<input className={input} value={staff} onChange={(e) => setStaff(e.target.value)} /></label>
        <p className="text-[11px] text-stone-400">교육청 매뉴얼 원문을 확인하고 고쳐 주세요. 고친 값은 가정통신문 초안에도 반영돼요.</p>
      </>)}
      <Buttons onSave={save} onCancel={onClose} />
    </div>
  );
}
