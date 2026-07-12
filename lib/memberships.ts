import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import type { Role, MembershipStatus } from "@/lib/constants";

export type CurrentMembership = {
  userId: string;
  email: string | null;
  groupId: string;
  groupName: string;
  role: Role;
  status: MembershipStatus;
};

export type MyMembership = {
  groupId: string;
  groupName: string;
  role: Role;
  status: MembershipStatus;
};

// 현재 선택된 조직을 담는 쿠키. 로그인할 때마다 지워져서
// 매 로그인마다 조직 선택 화면을 거친다 (한 계정 여러 조직 지원).
export const CURRENT_GROUP_COOKIE = "current_group";

// 유저의 모든 멤버십(active/pending) — 조직 선택 화면과 현재 조직 판정에 공용.
// cache(): 같은 요청에서 여러 번 호출해도 조회는 한 번만.
export const listMyMemberships = cache(async function listMyMemberships(): Promise<{
  userId: string;
  email: string | null;
  memberships: MyMembership[];
}> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("memberships")
    .select("group_id, role, status, groups(name)")
    .eq("user_id", user.id)
    .in("status", ["active", "pending"])
    .order("approved_at", { ascending: false });

  return {
    userId: user.id,
    email: user.email ?? null,
    memberships: (data ?? []).map((m) => ({
      groupId: m.group_id,
      // 승인 대기 멤버는 RLS상 그룹 행을 아직 못 읽어 embed가 null일 수 있다.
      groupName:
        (m.groups as unknown as { name: string } | null)?.name ?? "승인 대기 중인 조직",
      role: m.role,
      status: m.status,
    })),
  };
});

// 현재 조직의 활성 멤버십을 반환. 없으면 상황에 맞게 리다이렉트:
// 활성 멤버십 0개 → (승인 대기 있으면 /pending, 아니면 /select-group)
// 활성 멤버십은 있지만 조직 미선택/불일치 → /select-group
export const requireCurrentMembership = cache(async function requireCurrentMembership(): Promise<CurrentMembership> {
  const { userId, email, memberships } = await listMyMemberships();
  const active = memberships.filter((m) => m.status === "active");
  if (active.length === 0) {
    redirect(memberships.some((m) => m.status === "pending") ? "/pending" : "/select-group");
  }

  const selected = (await cookies()).get(CURRENT_GROUP_COOKIE)?.value;
  const current = active.find((m) => m.groupId === selected);
  if (!current) redirect("/select-group");

  return { userId, email, ...current };
});
