// 화면에서만 쓰는 작은 날짜 도우미 (계산은 lib/dates.ts 를 쓰고, 여기엔 표시용만 둡니다)
import type { DateString } from "./types";

export const parse = (s: DateString) => new Date(s + "T00:00:00Z");
export const mmdd = (s: DateString) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`;

/** 메모 작성자 표시. "2026 담당 교사"처럼 이미 연도가 있으면 연도를 또 붙이지 않는다 */
export const byline = (year: number, author?: string) =>
  author?.includes(String(year)) ? author : `${year} ${author ?? "전임자"}`;

/** "업체 선정·계약, 사전답사" → "업체 선정·계약" (좁은 위젯용) */
export const shortStep = (label: string) => label.split(",")[0].split(" / ")[0];

/** 오늘 기준 상대 날짜: 0 → "오늘", 3 → "3일 뒤", -7 → "7일 전" */
export const relDays = (d: number) => (d === 0 ? "오늘" : d > 0 ? `${d}일 뒤` : `${-d}일 전`);
