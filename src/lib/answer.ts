import { events, guidelines, changes, budgets, venues, won } from "./data";

export type Source = { id: string; label: string; status?: "시행" | "추진 중" };
export type Answer = { answer: string; sources: Source[] };

/** 출처 칩 id 규칙: G-*(지침) C-*(변경 알림) E-*(행사 카드) B-*(예산) V-*(장소) H-E-*(담당 이력) */
const src = (id: string): Source => {
  const g = guidelines.find((x) => x.id === id);
  if (g) return { id, label: `${g.title.split("(")[0].trim()} · ${g.year} 기준`, status: g.status };
  if (id.startsWith("H-")) return { id, label: "2026 전임자 메모" };
  if (id.startsWith("B-")) return { id, label: `예산 ${id} · 2026 집행 기록(가상)` };
  if (id.startsWith("V-")) return { id, label: `장소 ${id}` };
  const e = events.find((x) => x.id === id);
  if (e) return { id, label: `행사카드 ${id} · 전임자 메모` };
  const c = changes.find((x) => x.id === id);
  return { id, label: c ? `변경 알림 ${id}` : id, status: c?.status };
};

/** 데모 모드: 등록된 자료 안에서만 키워드로 답한다. (LLM 연결 시 이 자리에 교체) */
export function answerQuestion(q: string): Answer {
  const t = q.replace(/\s/g, "");
  const ev = events.find((e) => t.includes("수학여행") && e.id === "E-03") ?? events.find((e) => (t.includes("체험학습") || t.includes("1일형")) && e.id === "E-02");

  if (/1인당|경비|예산|얼마/.test(t)) {
    const b = budgets.find((x) => x.eventId === (ev?.id ?? "E-03"))!;
    const e = events.find((x) => x.id === b.eventId)!;
    const cur = b.sources.find((s) => s.perStudent)?.perStudent;
    const last = b.lastYear.perStudent;
    const diff = cur && last ? `올해 편성은 ${cur.toLocaleString()}원으로 작년보다 ${(cur - last).toLocaleString()}원 ${cur >= last ? "늘었어요" : "줄었어요"}. ` : "";
    return { answer: `${e.title}: 작년(2026) 총 ${won(b.lastYear.total)}${last ? `, 1인당 ${last.toLocaleString()}원` : ""}이었어요. ${diff}작년 메모: ${b.lastYear.memo}. (학교 입력값/가상 데이터 기준이에요.)`, sources: [src(b.id), src(`H-${e.id}`)] };
  }
  if (/정산|공개/.test(t))
    return { answer: "인천 매뉴얼 설명 기준으로 행사 후 10일 이내에 정산하고, 수익자부담 경비는 정산일로부터 10일 이내에 학부모에게 공개해야 해요. 행사 카드 체크리스트에 마감일이 자동으로 들어가 있어요. (2차 자료 기준이라 원문 확인이 필요해요.)", sources: [src("G-INC-01"), src("B-03")] };
  if (/점검|수련원|수련시설|숙소|리조트|장소|비상구/.test(t) && !/답사/.test(t)) {
    const v = /숙소|리조트|비상구/.test(t) ? venues.find((x) => x.id === "V-02")! : venues.find((x) => x.id === "V-01")!;
    const h = v.history[0];
    return { answer: `${v.name}(${v.type})의 마지막 점검 연도는 ${v.lastInspectionYear}년이에요. 학교에서 ${v.travelMinutes}분 거리이고 작년(${h.year}) 메모는 "${h.memo}"예요. (가상 데이터)`, sources: [src(v.id)] };
  }
  if (/담당|전임|누가|작년.*(메모|했)/.test(t)) {
    const o = events.find((e) => e.id === "E-03")!.ownerHistory[0];
    return { answer: `2026 수학여행 ${o.role}${o.consentToShow && o.name ? `(${o.name} 선생님, ${o.contact})` : "(비공개)"}의 메모예요. 잘된 점: ${o.notes.good}. 문제였던 점: ${o.notes.problem}. 내년엔: ${o.notes.nextYear}.`, sources: [src("H-E-03")] };
  }
  if (/동의/.test(t))
    return { answer: "인천광역시교육청 기준으로 학년 전체 학부모 80% 이상의 동의가 필요해요. (2026 매뉴얼 기준, 다른 교육청은 숫자가 다를 수 있어요.)", sources: [src("G-INC-01"), src("E-03")] };
  if (/안전요원|보조인력/.test(t))
    return { answer: "인천광역시교육청 기준으로 학생 50명당 1명(100명 이상일 때)을 배치해야 해요. 수학여행(180명)이라면 4명 이상이 되는 셈이에요.", sources: [src("G-INC-01")] };
  if (/책임|면책|사고/.test(t))
    return { answer: "현행 기준은 \"안전조치 의무를 다한 경우\" 교사의 책임이 면제돼요. 다만 \"고의·중과실이 없으면 면책\"으로 바꾸는 개정이 추진 중이라 아직 확정은 아니에요. 법적 판단은 교육청·전문가 확인이 필요해요.", sources: [src("G-NAT-02"), src("G-NAT-03")] };
  if (/글자|특기사항|학생부|기재/.test(t))
    return { answer: "2026학년도부터 창체 진로활동 특기사항은 700자에서 500자로, 행동특성 및 종합의견은 500자에서 300자로 줄었어요(시행 중).", sources: [src("G-NAT-01"), src("C-01")] };
  if (/업체|답사/.test(t))
    return { answer: "전임자 메모: 사전답사 때 숙소 비상구·동선을 사진으로 남기세요. 작년엔 비상구 확인이 늦었어요.", sources: [src("E-03")] };
  return { answer: "등록된 자료에서 찾지 못했어요. 부장님이나 교육청 매뉴얼을 확인해 주세요.", sources: [] };
}
