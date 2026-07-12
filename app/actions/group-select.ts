"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { CURRENT_GROUP_COOKIE } from "@/lib/memberships";

// 조직 선택 — 내 활성 멤버십인지 검증 후 현재 조직 쿠키를 설정하고 앱으로 진입.
export async function setCurrentGroup(input: { groupId: string }): Promise<{ error?: string }> {
  if (!input?.groupId) return { error: "잘못된 요청" };
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: mem } = await supabase
    .from("memberships")
    .select("group_id")
    .eq("user_id", user.id)
    .eq("group_id", input.groupId)
    .eq("status", "active")
    .maybeSingle();
  if (!mem) return { error: "이 조직의 멤버가 아니에요" };

  (await cookies()).set(CURRENT_GROUP_COOKIE, input.groupId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    sameSite: "lax",
  });
  redirect("/attendance");
}
