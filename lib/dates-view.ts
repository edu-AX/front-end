// 화면에서만 쓰는 작은 날짜 도우미 (계산은 lib/dates.ts 를 쓰고, 여기엔 표시용만 둡니다)
import type { DateString } from "./types";

export const parse = (s: DateString) => new Date(s + "T00:00:00Z");
export const mmdd = (s: DateString) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`;
