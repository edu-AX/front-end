export const levels = {
  middle: { name: "중학교", school: "한빛중학교" },
  high: { name: "고등학교", school: "한빛고등학교" },
} as const;
export type Level = keyof typeof levels;

export const departments = [
  { slug: "activities", name: "창의적 체험활동부", icon: "🌱", desc: "교내·교외 행사, 학생부 기재 안내", color: "border-emerald-300 bg-emerald-100" },
  { slug: "academic", name: "교무기획부", icon: "📋", desc: "학사 일정, 교육과정 운영", color: "border-amber-300 bg-amber-100" },
  { slug: "safety", name: "학생생활안전부", icon: "🛡️", desc: "학생 생활 지도, 안전 교육", color: "border-rose-300 bg-rose-100" },
  { slug: "career", name: "진로진학상담부", icon: "🧭", desc: "진로 상담, 진학 지도", color: "border-sky-300 bg-sky-100" },
  { slug: "afterschool", name: "방과후학교부", icon: "🎒", desc: "방과후 강좌 운영", color: "border-violet-300 bg-violet-100" },
  { slug: "it", name: "정보부", icon: "💻", desc: "교내 정보화, 기자재 관리", color: "border-cyan-300 bg-cyan-100" },
  { slug: "research", name: "연구부", icon: "🔬", desc: "교원 연수, 연구 업무", color: "border-lime-300 bg-lime-100" },
] as const;

export const isLevel = (v: string): v is Level => v in levels;
/** 실제 내용이 구현된 부서 */
export const hasContent = (level: Level, slug: string) => level === "high" && slug === "activities";
