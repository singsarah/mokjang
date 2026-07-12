import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoEmail } from "@/lib/demo";

// 초대 링크: /invite/<코드> 를 열면 코드를 쿠키에 저장하고 /join 으로 보낸다.
// 이 라우트는 온보딩 레이아웃(PrivacyGate) 밖이라 로그인 전에도 실행되므로,
// 로그인/가입으로 튕겨도 쿠키가 남아 코드가 유지된다.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const clean = (code ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);

  // 체험 세션인 채로 초대 링크를 열면 일회용 체험 계정 명의로 참여 신청이
  // 들어가므로, 체험 계정은 로그아웃시키고 실제 가입으로 보낸다(코드 쿠키는 유지).
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let dest = "/join";
  if (user && isDemoEmail(user.email)) {
    await supabase.auth.signOut();
    dest = "/signup";
  }

  const res = NextResponse.redirect(new URL(dest, req.url));
  if (clean.length === 8) {
    res.cookies.set("pending_join_code", clean, {
      path: "/",
      maxAge: 60 * 60, // 1시간
      sameSite: "lax",
    });
  }
  return res;
}
