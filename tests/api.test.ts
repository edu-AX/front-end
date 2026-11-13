// 백엔드 연동 설정: API 주소와 동기화 lock 이 올바른지
import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { API_BASE, apiUrl } from "@/lib/api";

describe("백엔드 API 주소", () => {
  it("기본값은 로컬 백엔드(3001), 끝 슬래시 없이", () => {
    expect(API_BASE).toMatch(/^https?:\/\/[^/]+(\/.*[^/])?$/);
    expect(apiUrl("/api/chat")).toBe(`${API_BASE}/api/chat`);
  });
});

describe("backend.lock.json", () => {
  const lock = JSON.parse(readFileSync("backend.lock.json", "utf8"));
  it("백엔드 저장소와 고정 커밋을 가리킨다", () => {
    expect(lock.repo).toBe("https://github.com/edu-AX/back-end.git");
    expect(lock.commit).toMatch(/^[0-9a-f]{40}$/);
  });
  it("공유 파일이 모두 이 저장소에 있다", () => {
    for (const f of lock.files as string[]) expect(existsSync(f), f).toBe(true);
  });
  it("서버 전용 코드는 공유 목록에 없다 (프론트에 API 키·서버 코드가 들어오지 않게)", () => {
    for (const f of ["lib/chat/llm.ts", "lib/env.ts", "lib/upload/extract.ts"]) expect(lock.files).not.toContain(f);
  });
});
