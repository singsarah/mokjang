import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-pasture-50 p-6">
      <h1 className="text-4xl font-bold text-pasture-600">🐑 목장 관리</h1>
      <p className="text-center text-lg text-gray-700">
        모든 모임 관리를 편하게
      </p>
      <div className="flex flex-col gap-3 pt-6 sm:flex-row">
        <Link
          href="/login"
          className="rounded-lg bg-pasture-500 px-8 py-3 text-center text-white shadow hover:bg-pasture-600"
        >
          로그인
        </Link>
        <Link
          href="/signup"
          className="rounded-lg border-2 border-pasture-500 px-8 py-3 text-center text-pasture-600 hover:bg-pasture-100"
        >
          가입하기
        </Link>
      </div>
    </main>
  );
}
