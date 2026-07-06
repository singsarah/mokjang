import { type NextRequest, NextResponse } from "next/server";

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

  const res = NextResponse.redirect(new URL("/join", req.url));
  if (clean.length === 8) {
    res.cookies.set("pending_join_code", clean, {
      path: "/",
      maxAge: 60 * 60, // 1시간
      sameSite: "lax",
    });
  }
  return res;
}
