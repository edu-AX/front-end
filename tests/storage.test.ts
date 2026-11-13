// 저장소 어댑터(작업 6): localStorage 구현이 기존과 같은 키·모양으로 저장하는지
import { beforeEach, describe, expect, it } from "vitest";
import { LOCAL_STATE_KEY, localHandoverStorage, STORAGE_SCOPE } from "@/lib/storage";
import { EMPTY_CLIENT_STATE } from "@/lib/types";

const mem = new Map<string, string>();
beforeEach(() => {
  mem.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  };
});

describe("localHandoverStorage", () => {
  const { schoolId, deptId } = STORAGE_SCOPE;

  it("저장한 적 없으면 null", async () => {
    expect(await localHandoverStorage.load(schoolId, deptId)).toBeNull();
  });

  it("기존 키 handover:v1 에 저장하고 그대로 읽는다", async () => {
    const st = { ...EMPTY_CLIENT_STATE, handoverAcceptedAt: "2027-03-11", acknowledgedNoteKeys: ["N-07-1"] };
    await localHandoverStorage.save(schoolId, deptId, st);
    expect(JSON.parse(mem.get(LOCAL_STATE_KEY)!)).toEqual(st);
    expect(await localHandoverStorage.load(schoolId, deptId)).toEqual(st);
  });

  it("예전 버전에서 저장한 상태(새 필드 없음)도 기본값을 채워 읽는다", async () => {
    mem.set(LOCAL_STATE_KEY, JSON.stringify({ stepStatus: { "E-07": { plan: "done" } } }));
    const s = await localHandoverStorage.load(schoolId, deptId);
    expect(s).toMatchObject({ stepStatus: { "E-07": { plan: "done" } }, addedEvents: [], confirmedChangeIds: [] });
  });
});
