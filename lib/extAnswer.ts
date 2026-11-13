// 예산·장소·담당 이력 질문은 백엔드 챗봇이 아직 모르는 자료라, 화면에서 먼저 등록된 자료로 답한다.
// (백엔드 /api/chat 에 이 자료가 들어가면 이 파일은 지워도 된다)
import { events } from "./data";
import { allBudgets, getExt, venues, won } from "./ext";
import { DISCLAIMER } from "./chat/messages";
import type { ChatResponse, SourceRef } from "./types";

export type LocalSource = SourceRef & { tab?: "budget" | "venue" | "owner" };
export type LocalResponse = Omit<ChatResponse, "sources"> & { sources: LocalSource[] };

const mk = (answer: string, sources: LocalSource[]): LocalResponse => ({ answer, sources, notFound: false, mode: "demo", disclaimer: DISCLAIMER });

function pickEvent(t: string, fallback: string) {
  if (t.includes("체육대회")) return "E-03";
  if (/체험학습|1일형/.test(t)) return "E-02";
  if (/수학여행/.test(t)) return "E-07";
  return fallback;
}

export function answerExt(q: string, focusEventId?: string): LocalResponse | null {
  const t = q.replace(/\s/g, "");

  if (/1인당|경비|예산|얼마/.test(t)) {
    const budgets = allBudgets(); // 업로드로 추가한 예산 포함
    const eid = pickEvent(t, budgets.some((b) => b.eventId === focusEventId) ? focusEventId! : "E-07");
    const b = budgets.find((x) => x.eventId === eid);
    const e = events.find((x) => x.id === eid);
    if (!b || !e) return null;
    const cur = b.sources.find((s) => s.perStudent)?.perStudent;
    const last = b.lastYear.perStudent;
    const diff = cur && last ? `올해 편성은 ${cur.toLocaleString()}원으로 작년보다 ${Math.abs(cur - last).toLocaleString()}원 ${cur >= last ? "늘었어요" : "줄었어요"}. ` : "";
    return mk(`${e.title}: 작년(2026) 총 ${won(b.lastYear.total)}${last ? `, 1인당 ${last.toLocaleString()}원` : ""}이었어요. ${diff}작년 메모: ${b.lastYear.memo}. (학교 입력값/가상 데이터 기준이에요.)`,
      [{ id: b.id, kind: "event", label: `예산 ${b.id} · 2026 집행 기록(가상)`, openEventId: eid, tab: "budget" }]);
  }
  if (/정산|공개/.test(t)) {
    return mk("인천 매뉴얼 설명 기준으로 행사 후 10일 이내에 정산하고, 수익자부담 경비는 정산일로부터 10일 이내에 학부모에게 공개해야 해요. 행사 카드 체크리스트에 마감일이 자동으로 들어가 있어요. (2차 자료 기준이라 원문 확인이 필요해요.)",
      [{ id: "B-03", kind: "event", label: "예산 B-03 · 정산 일정", openEventId: "E-07", tab: "budget" }]);
  }
  if (/점검|수련원|수련시설|숙소|리조트|비상구/.test(t) && !/답사/.test(t)) {
    const v = /숙소|리조트|비상구/.test(t) ? venues.find((x) => x.id === "V-02") : venues.find((x) => x.id === "V-01");
    if (!v) return null;
    const h = v.history[0];
    const eid = events.find((e) => getExt(e.id).venueIds.includes(v.id))?.id;
    return mk(`${v.name}(${v.type})의 마지막 점검 연도는 ${v.lastInspectionYear}년이에요. 학교에서 ${v.travelMinutes}분 거리이고 작년(${h.year}) 메모는 "${h.memo}"예요. (가상 데이터)`,
      [{ id: v.id, kind: "event", label: `장소 ${v.id} · ${v.name}`, openEventId: eid, tab: "venue" }]);
  }
  if (/담당|전임/.test(t)) {
    const eid = pickEvent(t, "E-07");
    const o = getExt(eid).ownerHistory[0];
    const e = events.find((x) => x.id === eid);
    if (!o || !e) return null;
    return mk(`2026 ${e.title} ${o.role}${o.consentToShow && o.name ? `(${o.name} 선생님, ${o.contact})` : "(비공개)"}의 메모예요. 잘된 점: ${o.notes.good}. 문제였던 점: ${o.notes.problem}. 내년엔: ${o.notes.nextYear}.`,
      [{ id: `H-${eid}`, kind: "event", label: "2026 전임자 메모", openEventId: eid, tab: "owner" }]);
  }
  return null;
}
