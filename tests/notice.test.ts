import { describe, expect, it } from "vitest";
import { getEvent } from "@/lib/data";
import { computeSchedule } from "@/lib/schedule";
import { buildNotice, noticeFacts } from "@/lib/notice";
import { EMPTY_CLIENT_STATE } from "@/lib/types";

const ev = getEvent("E-07")!;
const ctx = (today: string) => ({ date: ev.eventDate, today, schedule: computeSchedule(ev, today, EMPTY_CLIENT_STATE), discloseDue: "2027-06-01" });

describe("가정통신문 행사 정보(facts)", () => {
  it("행사 카드 값으로 서버에 보낼 정보를 만든다", () => {
    const f = noticeFacts(ev, ctx("2027-03-11"));
    expect(f).toMatchObject({ schoolName: "인덕고등학교", year: "2027", eventTitle: ev.title, scope: "교외", eventDate: ev.eventDate, today: "2027-03-11", discloseDue: "2027-06-01" });
    expect(f.nights).toContain("박"); // 숙박형: 며칠인지는 카드에 없어 빈칸으로
    expect(f.costPerStudent).toBe(300000);
    expect(f.costItems.length).toBeGreaterThan(0);
    expect(f.safetyEduDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("이미 지난 제출 기한은 보내지 않는다(서버가 빈칸으로 만든다)", () => {
    expect(noticeFacts(ev, ctx("2027-03-11")).consentDue).toBeNull(); // 동의서 마감(D-90)이 지남
    expect(noticeFacts(ev, ctx("2027-01-01")).consentDue).not.toBeNull();
  });

  it("기본 양식 초안도 그대로 동작한다", () => {
    const t = buildNotice("consent", ev, ctx("2027-03-11"));
    expect(t).toContain(ev.title);
    expect(t).toContain("절 취 선");
  });
});
