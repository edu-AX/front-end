// 인수인계 상태 저장소 어댑터.
//
// ▶ 학교·부서 단위 서버 저장(예: 학교 행정 시스템 연동)으로 교체하는 지점.
//   지금은 시연용으로 브라우저 localStorage 에만 저장한다. 그래서 같은 PC·같은 브라우저에서만 이어진다.
//   실제 운영에서는 HandoverStorage 를 서버 API(학교 ID·부서 ID 단위 저장, 교원 인증·역할 권한 포함)로
//   구현한 객체로 바꾸기만 하면, 화면(lib/state.tsx)은 고치지 않아도 다음 해 담당자에게 그대로 넘어간다.
import { EMPTY_CLIENT_STATE, type ClientState } from "./types";

export interface HandoverStorage {
  load(schoolId: string, deptId: string): Promise<ClientState | null>;
  save(schoolId: string, deptId: string, state: ClientState): Promise<void>;
}

/** 지금 화면이 쓰는 학교·부서 (데모: 인덕고 창체부 하나) */
export const STORAGE_SCOPE = { schoolId: "induk-high", deptId: "activities" } as const;

/** localStorage 키. 기존 데이터와 호환되도록 그대로 둔다 (데모는 학교·부서가 하나뿐) */
export const LOCAL_STATE_KEY = "handover:v1";

export const localHandoverStorage: HandoverStorage = {
  async load() {
    try {
      const raw = localStorage.getItem(LOCAL_STATE_KEY);
      return raw ? { ...EMPTY_CLIENT_STATE, ...JSON.parse(raw) } : null;
    } catch {
      return null;
    }
  },
  async save(_schoolId, _deptId, state) {
    try {
      localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(state));
    } catch {}
  },
};

/** 화면이 실제로 쓰는 저장소. 서버 저장으로 바꿀 때 이 한 줄만 교체 */
export const handoverStorage: HandoverStorage = localHandoverStorage;
