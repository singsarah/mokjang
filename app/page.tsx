import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";

export default async function LandingPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: membership } = await supabase
      .from("memberships")
      .select("status")
      .eq("user_id", user.id)
      .in("status", ["active", "pending"])
      .maybeSingle();

    if (membership?.status === "active") redirect("/attendance");
    if (membership?.status === "pending") redirect("/pending");
    redirect("/join");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-pasture-50 p-6">
      <h1 className="font-display text-4xl font-bold text-pasture-600">🐑 목장 관리</h1>
      <p className="text-center text-lg text-gray-700">
        교회 고등부 출석·일정·생일 관리
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
