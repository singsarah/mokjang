"use server";

import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";

// 계정 삭제 — 되돌릴 수 없음.
// - 혼자 사용 중인 그룹(다른 활성 멤버 없음)은 그룹의 모든 기록과 함께 삭제.
// - 다른 교사와 함께 쓰는 그룹은 탈퇴만 하고 그룹 기록은 유지.
//   단, 본인이 유일한 마스터면 그룹이 주인 없이 남으므로 차단(다른 마스터 임명 후 재시도).
// - 남은 기록의 계정 참조(created_by 등)는 FK SET NULL로 익명화(마이그레이션 20260712000002).
export async function deleteAccount(): Promise<{ error?: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  const admin = createServiceRoleClient();

  const { data: mems, error: memErr } = await admin
    .from("memberships")
    .select("group_id, role, status")
    .eq("user_id", user.id);
  if (memErr) return { error: "계정 정보를 확인하지 못했어요. 다시 시도해주세요." };

  // 1차: 삭제를 진행해도 되는지 전부 검증 (중간에 막혀 반쯤 지워지는 일 방지)
  const groupsToDelete: string[] = [];
  for (const mem of mems ?? []) {
    const { data: others, error: othersErr } = await admin
      .from("memberships")
      .select("role")
      .eq("group_id", mem.group_id)
      .eq("status", "active")
      .neq("user_id", user.id);
    if (othersErr) return { error: "계정 정보를 확인하지 못했어요. 다시 시도해주세요." };
    const otherActive = others ?? [];
    if (otherActive.length === 0) {
      groupsToDelete.push(mem.group_id);
    } else if (
      mem.role === "master" &&
      mem.status === "active" &&
      !otherActive.some((o) => o.role === "master")
    ) {
      return {
        error:
          "이 그룹의 유일한 마스터라서 계정을 삭제할 수 없어요. 교사 관리에서 다른 교사를 마스터로 임명한 뒤 다시 시도해주세요.",
      };
    }
  }

  // 2차: 실행 — 혼자 쓰던 그룹 삭제(학생·출석·일정·회의록 CASCADE) 후 계정 삭제.
  for (const groupId of groupsToDelete) {
    const { error } = await admin.from("groups").delete().eq("id", groupId);
    if (error) return { error: "그룹 정리에 실패했어요. 다시 시도해주세요." };
  }
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) return { error: "계정 삭제에 실패했어요. 다시 시도해주세요." };

  // 브라우저 세션 쿠키 정리 (계정은 이미 삭제됨 — 실패해도 무시)
  await supabase.auth.signOut().catch(() => {});
  redirect("/");
}
