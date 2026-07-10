import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { Icon } from "@/components/icon";
import { DemoStartButton } from "@/components/demo-start-button";

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
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-sage-soft p-6">
      <Icon name="cross" size={26} className="opacity-80" alt="십자가" />
      <Icon name="sheep-face" size={104} alt="양 얼굴 로고" />
      <h1 className="font-display text-4xl font-bold text-sage-deep">목장 관리</h1>
      <p className="text-center text-lg text-ink">
        교회 고등부 출석·일정·생일 관리
      </p>
      {/* 로그인/가입 두 상자 동일 크기, 체험 상자는 그 두 상자의 전체 폭에 좌우 정렬 */}
      <div className="grid w-full max-w-xs grid-cols-2 gap-3 pt-6">
        <Link
          href="/login"
          className="rounded-btn border-2 border-sage bg-sage py-3 text-center font-medium text-white shadow-sm transition hover:border-sage-deep hover:bg-sage-deep"
        >
          로그인
        </Link>
        <Link
          href="/signup"
          className="rounded-btn border-2 border-sage py-3 text-center text-sage-deep transition hover:bg-sage-soft"
        >
          가입하기
        </Link>
      </div>
      <DemoStartButton className="w-full max-w-xs" />
    </main>
  );
}
