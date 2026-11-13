import Link from "next/link";
import Logo from "@/components/Logo";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6">
      <Logo width={420} href={null} />
      <h1 className="mb-1 mt-4 text-2xl font-bold">교사 인수인계 플랫폼</h1>
      <p className="mb-2 text-sm font-semibold text-amber-700">한빛학교 · 데모</p>
      <p className="mb-10 text-center text-stone-600">작년 담당자의 기록과 올해 기준을 한 화면에서 이어드려요.</p>
      <div className="grid w-full gap-4 sm:grid-cols-2">
        <Link href="/middle" className="rounded-3xl border-2 border-emerald-300 bg-emerald-100 p-8 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-md">
          <div className="mb-2 text-4xl">🏫</div><div className="text-xl font-bold">중학교</div><div className="mt-1 text-sm text-stone-600">선택하기</div>
        </Link>
        <Link href="/high" className="rounded-3xl border-2 border-amber-300 bg-amber-100 p-8 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-md">
          <div className="mb-2 text-4xl">🎓</div><div className="text-xl font-bold">고등학교</div><div className="mt-1 text-sm text-stone-600">선택하기</div>
        </Link>
      </div>
    </main>
  );
}
