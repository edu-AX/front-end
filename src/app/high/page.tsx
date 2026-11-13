import Link from "next/link";

const depts = ["교무기획부", "학생생활안전부", "진로진학상담부", "방과후학교부", "정보부", "연구부"];

export default function High() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm text-stone-500 hover:underline">← 학교급 선택</Link>
      <h1 className="mb-1 mt-4 text-2xl font-bold">부서를 선택하세요</h1>
      <p className="mb-8 text-stone-600">한빛고등학교</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/high/activities" className="rounded-3xl border-2 border-emerald-300 bg-emerald-100 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
          <div className="mb-1 text-3xl">🌱</div><div className="text-lg font-bold">창의적 체험활동부</div>
          <div className="mt-1 text-sm text-stone-600">교내·교외 행사, 학생부 기재 안내</div>
        </Link>
        {depts.map((d) => (
          <div key={d} className="rounded-3xl border-2 border-dashed border-stone-300 bg-white/60 p-6 text-stone-400">
            <div className="text-lg font-bold">{d}</div><div className="mt-1 text-sm">준비 중</div>
          </div>
        ))}
      </div>
    </main>
  );
}
