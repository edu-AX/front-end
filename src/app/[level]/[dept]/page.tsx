import Link from "next/link";
import { notFound } from "next/navigation";
import { departments, isLevel, levels } from "@/lib/school";

export default async function DeptPage({ params }: { params: Promise<{ level: string; dept: string }> }) {
  const { level, dept } = await params;
  const d = departments.find((x) => x.slug === dept);
  if (!isLevel(level) || !d) notFound();
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
      <nav className="mb-6 text-xs text-stone-500">{levels[level].school} › {levels[level].name} › {d.name}</nav>
      <div className="mb-3 text-6xl">{d.icon}</div>
      <h1 className="mb-2 text-2xl font-bold">{d.name}</h1>
      <p className="mb-1 text-stone-600">{d.desc}</p>
      <p className="mb-8 rounded-full bg-amber-100 px-4 py-1 text-sm text-amber-800">🚧 이 화면은 준비 중이에요</p>
      <Link href={`/${level}`} className="rounded-full bg-stone-800 px-5 py-2 text-sm font-bold text-white">← 부서 선택으로</Link>
    </main>
  );
}
