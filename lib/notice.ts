// 가정통신문 초안. 행사 카드에 있는 값(행사명·일시·장소·경비·안전 기준·마감일)으로 채우고,
// 카드에 없는 값은 【   】 빈칸으로 남겨 담당자가 채우게 한다. (AI 없이 템플릿만으로 만든다)
// 형식(문체·서식)은 학교가 쓰던 통신문 예시를 받아 맞춰 갈 예정이라, 문구는 모두 이 파일 한 곳에만 둔다.
import { findVenue, getExt, eventBudget, won } from "./ext";
import { levels } from "./school";
import type { DateString, EventCard, ScheduledStep } from "./types";

export type NoticeKind = "consent" | "settlement";

export const NOTICE_LABEL: Record<NoticeKind, string> = {
  consent: "행사 안내 및 참가 동의서",
  settlement: "경비 정산 안내",
};

/** 체크리스트의 어느 단계에서 어떤 통신문을 만들 수 있는지 */
export function noticeKindForStep(stepKey: string): NoticeKind | null {
  if (stepKey === "consent") return "consent";
  if (stepKey === "disclose") return "settlement";
  return null;
}

export const BLANK = "【   】";
export const countBlanks = (text: string) => (text.match(/【\s*】/g) ?? []).length;

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
export function korDate(d: DateString | null | undefined): string {
  if (!d) return BLANK;
  const dt = new Date(d + "T00:00:00Z");
  return `${dt.getUTCFullYear()}년 ${dt.getUTCMonth() + 1}월 ${dt.getUTCDate()}일(${DOW[dt.getUTCDay()]})`;
}

type Ctx = { date: DateString; today: DateString; schedule: ScheduledStep[]; settleDue?: DateString; discloseDue?: DateString };

const due = (schedule: ScheduledStep[], id: string) => schedule.find((s) => s.id === id)?.dueDate;
/** 학년 표시: 0(전교생)이거나 없으면 행사 대상으로 */
const target = (ev: EventCard) => (ev.grade ? `${ev.grade}학년` : "전교생");
const school = levels.high.school;

export function buildNotice(kind: NoticeKind, ev: EventCard, ctx: Ctx): string {
  const year = ctx.date.slice(0, 4);
  const venueNames = getExt(ev.id).venueIds.map((id) => findVenue(id)?.name).filter(Boolean) as string[];
  const budget = eventBudget(ev.id);
  const payer = budget?.sources.find((s) => s.perStudent);
  const rules = ev.officeRules;
  const nights = ev.template === "OUT_OVERNIGHT" ? `${BLANK}박 ${BLANK}일` : ev.scope === "교외" ? "당일" : "";
  const closing = [`${korDate(ctx.today)}`, "", `${school}장`].join("\n");

  if (kind === "settlement") {
    const items = budget?.items ?? [];
    const lines = [
      `${school} 가정통신문`,
      "",
      `제목: ${year}학년도 ${ev.title} 경비 정산 안내`,
      "",
      "학부모님께",
      "",
      `${ev.title}에 사용한 경비의 정산 결과를 아래와 같이 안내해 드립니다.`,
      "",
      "1. 행사 개요",
      `  - 행사명: ${ev.title}`,
      `  - 일시: ${korDate(ctx.date)}${nights ? ` (${nights})` : ""}`,
      `  - 참가 인원: ${ev.participants ? `${ev.participants}명` : BLANK}`,
      "",
      "2. 경비 정산 결과",
      `  - 수익자 부담 경비: 1인당 ${payer?.perStudent ? `${payer.perStudent.toLocaleString()}원` : BLANK}`,
      `  - 총 수입(수익자부담): ${payer ? won(payer.planned) : BLANK}`,
      `  - 총 집행액: ${BLANK}원`,
      `  - 잔액: ${BLANK}원 (1인당 환불액 ${BLANK}원)`,
      "",
      "3. 항목별 집행 내역",
      ...(items.length ? items.map((it) => `  - ${it.name}: 편성 ${won(it.planned)} / 집행 ${BLANK}원`) : [`  - ${BLANK}`]),
      "",
      "4. 안내 사항",
      `  - 잔액은 ${BLANK}에 환불(또는 ${BLANK}에 사용)할 예정입니다.`,
      `  - 정산 내용은 ${korDate(ctx.discloseDue)}까지 학교 홈페이지에 게시합니다.`,
      `  - 문의: ${school} ${BLANK}부 (${BLANK})`,
      "",
      closing,
    ];
    return lines.join("\n");
  }

  // 마감이 이미 지났으면 담당자가 새 회신 기한을 직접 정하게 빈칸으로 둔다
  const rawConsentDue = due(ctx.schedule, "consent");
  const consentDue = rawConsentDue && rawConsentDue >= ctx.today ? rawConsentDue : undefined;
  const safetyEdu = due(ctx.schedule, "safety_edu");
  const lines = [
    `${school} 가정통신문`,
    "",
    `제목: ${year}학년도 ${ev.title} 안내 및 참가 동의서`,
    "",
    "학부모님께",
    "",
    `${ev.title}을(를) 아래와 같이 계획하고 있어 안내해 드리며, 학부모님의 의견과 동의를 받고자 합니다.`,
    "",
    "1. 행사 개요",
    `  - 행사명: ${ev.title}`,
    `  - 일시: ${korDate(ctx.date)}${nights ? ` (${nights})` : ""}`,
    `  - 장소: ${venueNames.length ? venueNames.join(", ") : BLANK}`,
    `  - 대상: ${target(ev)}${ev.participants ? ` (${ev.participants}명)` : ""}`,
    `  - 집합 장소·시간: ${BLANK}`,
    `  - 준비물: ${BLANK}`,
    ...(ev.scope === "교외"
      ? ["", "2. 경비", `  - 학생 1인당 ${payer?.perStudent ? `${payer.perStudent.toLocaleString()}원 (수익자 부담)` : `${BLANK}원`}`, `  - 포함 내역: ${budget?.items.map((i) => i.name).join(", ") || BLANK}`]
      : []),
    "",
    `${ev.scope === "교외" ? "3" : "2"}. 안전 대책`,
    `  - 인솔 교사 및 안전요원: ${rules?.safetyStaff ? `${rules.safetyStaff} 기준으로 배치` : `${BLANK}명 배치`}`,
    `  - 사전 안전교육: ${korDate(safetyEdu)}에 실시`,
    `  - 비상 연락: ${school} ${BLANK}부 (${BLANK})`,
    "",
    `${ev.scope === "교외" ? "4" : "3"}. 참가 동의 안내`,
    "  - 학부모님의 의견을 모아 행사 추진 여부와 세부 내용을 결정합니다.",
    `  - 아래 동의서를 ${korDate(consentDue)}까지 담임교사에게 제출해 주시기 바랍니다.`,
    "",
    closing,
    "",
    "- - - - - - - - - - - - - - - 절 취 선 - - - - - - - - - - - - - - -",
    "",
    `${ev.title} 참가 동의서`,
    "",
    `  학년 반 번호 이름: ${BLANK}학년 ${BLANK}반 ${BLANK}번 (이름: ${BLANK})`,
    "  건강상 알려야 할 사항(알레르기·지병 등): ",
    "",
    "  위 학생이 행사에 참가하는 것에  □ 동의합니다   □ 동의하지 않습니다",
    "",
    `  ${year}년 ${BLANK}월 ${BLANK}일`,
    `  학부모(보호자): ${BLANK} (서명 또는 인)`,
  ];
  return lines.join("\n");
}
