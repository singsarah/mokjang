import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { CURRENT_GROUP_COOKIE } from "@/lib/memberships";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=oauth`);
    }
  }
  // 로그인할 때마다 조직 선택 화면을 거치도록 이전 선택을 지운다.
  const res = NextResponse.redirect(`${origin}/`);
  res.cookies.delete(CURRENT_GROUP_COOKIE);
  return res;
}
