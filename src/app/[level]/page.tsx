import Link from "next/link";
import { notFound } from "next/navigation";
import { departments, hasContent, isLevel, levels } from "@/lib/school";

export default async function LevelPage({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params;
  if (!isLevel(level)) notFound();
  const info = levels[level];
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm text-stone-500 hover:underline">← 학교급 선택</Link>
      <h1 className="mb-1 mt-4 text-2xl font-bold">부서를 선택하세요</h1>
      <p className="mb-8 text-stone-600">{info.school}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {departments.map((d) => (
          <Link key={d.slug} href={`/${level}/${d.slug}`} className={`rounded-3xl border-2 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md ${d.color}`}>
            <div className="mb-1 text-3xl">{d.icon}</div>
            <div className="text-lg font-bold">{d.name}</div>
            <div className="mt-1 text-sm text-stone-600">{d.desc}</div>
            {!hasContent(level, d.slug) && <div className="mt-2 inline-block rounded-full bg-white/70 px-2 py-0.5 text-xs text-stone-500">준비 중</div>}
          </Link>
        ))}
      </div>
    </main>
  );
}
