import { events, guidelines, changes } from "./data";

export type Source = { id: string; label: string; status?: "시행" | "추진 중" };
export type Answer = { answer: string; sources: Source[] };

const src = (id: string): Source => {
  const g = guidelines.find((x) => x.id === id);
  if (g) return { id, label: `${g.title.split("(")[0].trim()} · ${g.year} 기준`, status: g.status };
  const e = events.find((x) => x.id === id);
  if (e) return { id, label: `행사카드 ${id} · 전임자 메모` };
  const c = changes.find((x) => x.id === id);
  return { id, label: c ? `변경 알림 ${id}` : id, status: c?.status };
};

/** 데모 모드: 등록된 자료 안에서만 키워드로 답한다. (LLM 연결 시 이 자리에 교체) */
export function answerQuestion(q: string): Answer {
  const t = q.replace(/\s/g, "");
  if (/동의/.test(t))
    return { answer: "인천광역시교육청 기준으로 학년 전체 학부모 80% 이상의 동의가 필요해요. (2026 매뉴얼 기준, 다른 교육청은 숫자가 다를 수 있어요.)", sources: [src("G-INC-01"), src("E-03")] };
  if (/안전요원|보조인력/.test(t))
    return { answer: "인천광역시교육청 기준으로 학생 50명당 1명(100명 이상일 때)을 배치해야 해요. 수학여행(180명)이라면 4명 이상이 되는 셈이에요.", sources: [src("G-INC-01")] };
  if (/책임|면책|사고/.test(t))
    return { answer: "현행 기준은 \"안전조치 의무를 다한 경우\" 교사의 책임이 면제돼요. 다만 \"고의·중과실이 없으면 면책\"으로 바꾸는 개정이 추진 중이라 아직 확정은 아니에요. 법적 판단은 교육청·전문가 확인이 필요해요.", sources: [src("G-NAT-02"), src("G-NAT-03")] };
  if (/글자|특기사항|학생부|기재/.test(t))
    return { answer: "2026학년도부터 창체 진로활동 특기사항은 700자에서 500자로, 행동특성 및 종합의견은 500자에서 300자로 줄었어요(시행 중).", sources: [src("G-NAT-01"), src("C-01")] };
  if (/업체|숙소|답사|비상구/.test(t))
    return { answer: "전임자 메모: 사전답사 때 숙소 비상구·동선을 사진으로 남기세요. 작년엔 비상구 확인이 늦었어요.", sources: [src("E-03")] };
  return { answer: "등록된 자료에서 찾지 못했어요. 부장님이나 교육청 매뉴얼을 확인해 주세요.", sources: [] };
}
