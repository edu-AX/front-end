"use client";
import { eventBudget, findVenue, getExt, safetyChecklists, won, type Venue } from "@/lib/ext";
import type { EventCard } from "@/lib/types";
import { NOT_IN_DOC } from "@/lib/uploadExtras";

const Empty = ({ children }: { children: React.ReactNode }) => <p className="rounded-2xl bg-white p-4 text-sm text-stone-400">{children}</p>;
/** 결과보고서 업로드로 채운 탭 표시 */
const FromUpload = () => (
  <p className="rounded-xl bg-violet-50 px-3 py-1.5 text-[11px] text-violet-700">📂 작년 결과보고서에서 가져온 내용이에요. 문서에 없던 칸은 &quot;{NOT_IN_DOC}&quot;으로 둬요.</p>
);
const nd = (v: string | number | null | undefined, ok = true) => (ok && v !== null && v !== undefined && v !== "" ? v : <span className="text-stone-400">{NOT_IN_DOC}</span>);

export function BudgetTab({ ev }: { ev: EventCard }) {
  const b = eventBudget(ev.id);
  if (!b) return <Empty>이 행사는 아직 예산 정보가 없어요. 담당자가 입력하거나 결과보고서에서 가져올 수 있어요.</Empty>;
  const planned = b.sources.reduce((n, x) => n + x.planned, 0);
  const spent = b.sources.reduce((n, x) => n + x.spent, 0);
  const payer = b.sources.find((x) => x.perStudent);
  const last = b.lastYear;
  const amt = (n: number, unknown?: boolean) => (unknown ? <span className="text-stone-400">{NOT_IN_DOC}</span> : won(n));
  return (
    <div className="space-y-4 text-sm">
      {b.fromUpload && <FromUpload />}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <table className="w-full">
          <thead className="bg-stone-50 text-xs text-stone-500"><tr><th className="p-2 text-left">재원</th><th className="p-2 text-right">{b.fromUpload ? "작년 집행" : "편성"}</th><th className="p-2 text-right">집행</th><th className="p-2 text-right">잔액</th></tr></thead>
          <tbody>
            {b.sources.length === 0 && <tr><td colSpan={4} className="p-2 text-xs text-stone-400">재원별 금액이 {NOT_IN_DOC}</td></tr>}
            {b.sources.map((x) => (
              <tr key={x.type} className="border-t border-stone-100">
                <td className="p-2">{x.type}{!x.transferable && <span className="ml-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">이·전용 불가</span>}</td>
                <td className="p-2 text-right">{amt(x.planned, x.amountUnknown)}</td><td className="p-2 text-right">{amt(x.spent, x.amountUnknown)}</td><td className="p-2 text-right font-semibold">{x.amountUnknown ? "-" : won(x.planned - x.spent)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-stone-200 font-bold"><td className="p-2">합계</td><td className="p-2 text-right">{won(planned)}</td><td className="p-2 text-right">{won(spent)}</td><td className="p-2 text-right">{won(planned - spent)}</td></tr>
          </tbody>
        </table>
      </div>

      {payer?.perStudent && (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex justify-between"><span className="text-stone-500">1인당 경비(수익자부담)</span><b>{payer.perStudent.toLocaleString()}원</b></div>
          {last.perStudent && !b.fromUpload && (
            <div className="mt-1 flex justify-between"><span className="text-stone-500">작년 대비</span>
              <b className={payer.perStudent > last.perStudent ? "text-red-500" : "text-emerald-600"}>{payer.perStudent >= last.perStudent ? "+" : "-"}{Math.abs(payer.perStudent - last.perStudent).toLocaleString()}원 (작년 {last.perStudent.toLocaleString()}원)</b>
            </div>
          )}
          <p className="mt-2 text-[11px] text-stone-400">학부모가 경비를 부담하는 현장체험학습은 학교운영위원회 심의 대상이에요.</p>
        </div>
      )}

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-2 text-xs font-bold text-stone-500">지출 항목{b.fromUpload ? "(작년 집행)" : "(편성)"}</div>
        {b.items.length === 0 ? <p className="text-xs text-stone-400">항목별 금액이 {NOT_IN_DOC}</p> : (
          <ul className="space-y-1.5">
            {b.items.map((it) => (
              <li key={it.name}>
                <div className="flex justify-between text-xs"><span>{it.name}</span><span>{amt(it.planned, it.amountUnknown)}</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-amber-400" style={{ width: `${planned ? (it.planned / planned) * 100 : 0}%` }} /></div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {b.settlement ? (
        <div className="rounded-2xl bg-amber-50 p-4">
          <div className="mb-1 font-bold">정산 일정 (체크리스트에 자동 추가됨)</div>
          <div>행사 후 <b>{b.settlement.dueDaysAfterEvent}일</b> 이내 정산 → 정산 후 <b>{b.settlement.disclosureDaysAfterSettlement}일</b> 이내 학부모 공개</div>
          <div className="mt-1 text-[11px] text-stone-400">근거 {b.settlement.officeSource} (2차 자료 기준, 원문 확인 필요)</div>
        </div>
      ) : b.fromUpload ? <Empty>정산 일정은 {NOT_IN_DOC} — 교육청 기준으로 담당자가 확인해 주세요.</Empty>
        : <Empty>수익자부담이 없는 교내 행사라 학부모 공개 정산 단계는 없어요.</Empty>}

      <div className="rotate-[-0.5deg] rounded-md bg-yellow-200 p-3 shadow">
        <div className="mb-1 text-[11px] text-yellow-800">작년 집행 · 총 {won(last.total)}</div>{last.memo}
      </div>
      <p className="text-[11px] text-stone-400">인수인계용 요약이에요. 실제 집행·결재는 학교회계 시스템(K-에듀파인)에서 해요. 금액은 가상 데이터예요.</p>
    </div>
  );
}

function VenueCard({ v }: { v: Venue }) {
  const up = !!v.fromUpload;
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div><div className="font-bold">{v.name}</div><div className="text-xs text-stone-500">{v.type} · {v.address}</div></div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${up ? "bg-stone-100 text-stone-500" : "bg-sky-100 text-sky-800"}`}>{v.lastInspectionYear ? `마지막 점검 ${v.lastInspectionYear}` : "점검 기록 없음"}</span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-stone-500">이동 시간</dt><dd>{up && !v.travelMinutes ? nd(null) : v.travelMinutes ? `학교에서 약 ${v.travelMinutes}분` : "교내"}</dd>
        <dt className="text-stone-500">버스 주차</dt><dd>{v.busParking}</dd>
        <dt className="text-stone-500">수용 인원</dt><dd>{v.capacity ? `${v.capacity}명` : nd(null)}</dd>
        <dt className="text-stone-500">업체</dt><dd>{v.vendor.name}{v.vendor.contract !== NOT_IN_DOC ? ` · ${v.vendor.contract}` : ""}</dd>
      </dl>
      {safetyChecklists[v.type] && (
        <>
          <div className="mt-3 text-xs font-bold text-stone-500">{v.type} 안전 확인 체크리스트</div>
          <ul className="mb-2 mt-1 list-disc space-y-0.5 pl-5 text-xs text-stone-600">{safetyChecklists[v.type].map((c) => <li key={c}>{c}</li>)}</ul>
        </>
      )}
      <div className="mt-2 text-xs font-bold text-stone-500">확인 결과</div>
      {v.safetyChecks.length === 0 ? <p className="mt-1 text-xs text-stone-400">안전 확인 결과가 {NOT_IN_DOC} — 사전답사 때 확인해 주세요.</p> : (
        <ul className="mt-1 space-y-1 text-xs">
          {v.safetyChecks.map((c) => (
            <li key={c.item} className="flex justify-between gap-2 rounded-lg bg-emerald-50 px-2 py-1"><span>✔ {c.item}</span><span className="shrink-0 text-stone-500">{c.result} · {c.checkedAt}</span></li>
          ))}
        </ul>
      )}
      <div className="mt-3 rounded-xl bg-rose-50 p-2 text-xs">🚑 {v.emergency.hospital} · 🚒 {v.emergency.fire} · 🚓 {v.emergency.police}</div>
      <div className="mt-3 text-xs font-bold text-stone-500">연도별 이용 메모</div>
      {v.history.map((h) => (
        <div key={h.year} className="mt-1 rotate-[-0.5deg] rounded-md bg-yellow-200 p-2 text-xs shadow">
          <span className="text-[11px] text-yellow-800">{h.year}년 · {h.rating ? <>만족도 {"★".repeat(h.rating)}{"☆".repeat(5 - h.rating)}</> : `만족도 ${NOT_IN_DOC}`}</span><br />{h.memo}
        </div>
      ))}
    </div>
  );
}

export function VenueTab({ ev }: { ev: EventCard }) {
  const list = getExt(ev.id).venueIds.map((id) => findVenue(id)).filter((v): v is Venue => !!v);
  if (list.length === 0) return <Empty>등록된 장소가 없어요. 정해지면 장소 카드를 추가해 다음 해에 재사용할 수 있어요.</Empty>;
  return (
    <div className="space-y-4 text-sm">
      {list.some((v) => v.fromUpload) && <FromUpload />}
      {list.map((v) => <VenueCard key={v.id} v={v} />)}
      <p className="text-[11px] text-stone-400">안전 확인 항목은 2014년 매뉴얼 기사 기준이며 최신 시·도 매뉴얼로 교체할 수 있어요. 장소·업체는 가상 데이터예요.</p>
    </div>
  );
}

export function OwnerTab({ ev }: { ev: EventCard }) {
  const x = getExt(ev.id);
  const list = x.ownerHistory;
  if (list.length === 0) return <Empty>등록된 담당 이력이 없어요. 전임자가 결과보고서를 올리면 만들어져요.</Empty>;
  return (
    <div className="space-y-3 text-sm">
      {x.fromUpload && <FromUpload />}
      {list.map((o) => (
        <div key={o.year} className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="font-bold">{o.year} · {o.role}</div>
            <span className="text-xs text-stone-500">{o.consentToShow && o.name ? `${o.name} 선생님${o.contact ? ` · ${o.contact}` : ""}` : "담당(비공개)"}</span>
          </div>
          <div className="mt-2 space-y-1.5 text-xs">
            <div className="rounded-lg bg-emerald-50 p-2"><b className="text-emerald-700">잘된 점</b> {o.notes.good}</div>
            <div className="rounded-lg bg-orange-50 p-2"><b className="text-orange-700">문제였던 점</b> {o.notes.problem}</div>
            <div className="rounded-lg bg-sky-50 p-2"><b className="text-sky-700">내년엔 이렇게</b> {o.notes.nextYear}</div>
          </div>
        </div>
      ))}
      <p className="text-[11px] text-stone-400">이름·연락은 본인이 공개에 동의한 경우에만 보여요. 개인 전화번호는 받지 않아요.</p>
    </div>
  );
}

export function CareerTab({ ev }: { ev: EventCard }) {
  const x = getExt(ev.id);
  const up = !!x.fromUpload;
  return (
    <div className="space-y-3 text-sm">
      {up && <FromUpload />}
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-1 text-xs font-bold text-stone-500">진로 계열</div>
        <div className="flex flex-wrap gap-1.5">
          {x.careerTracks.length === 0 ? <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs">{up ? NOT_IN_DOC : "공통(전 계열)"}</span>
            : x.careerTracks.map((t) => <span key={t} className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-800">{t}</span>)}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-y-1 text-xs">
          <dt className="text-stone-500">창체 영역</dt><dd>{x.creativeArea || (up ? nd(null) : "-")}</dd>
          <dt className="text-stone-500">대상</dt><dd>{x.target || (up ? nd(null) : "-")}</dd>
        </dl>
      </div>
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-1 text-xs font-bold text-stone-500">이 행사와 연결된 과목</div>
        {x.linkedSubjects.length === 0 ? <p className="text-xs text-stone-400">{up ? `연계 과목이 ${NOT_IN_DOC}` : "연결된 과목이 없어요. 학교 교육과정에서 골라 연결할 수 있어요."}</p>
          : <ul className="list-disc space-y-0.5 pl-5 text-xs">{x.linkedSubjects.map((s) => <li key={s}>{s}</li>)}</ul>}
      </div>
      <p className="text-[11px] text-stone-400">진로 계열은 커리어넷 7계열 기준이며, 과목명은 학교마다 달라 가상 예시예요.</p>
    </div>
  );
}
