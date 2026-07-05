"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireCurrentMembership } from "@/lib/memberships";
import type { Json } from "@/lib/supabase/database.types";

const roleEnum = z.enum(["editor", "viewer"]);

async function requireMaster() {
  const m = await requireCurrentMembership();
  if (m.role !== "master") throw new Error("마스터 권한이 필요합니다");
  return m;
}

async function logAudit(
  groupId: string,
  actorId: string,
  action: string,
  targetId: string,
  metadata: Json = {},
) {
  // audit_log has no user-facing INSERT policy by design, so write it with the
  // service-role client (bypasses RLS). Never surface a failure to the caller.
  const supabase = createServiceRoleClient();
  await supabase.from("audit_log").insert({
    group_id: groupId,
    actor_id: actorId,
    action,
    target_id: targetId,
    target_type: "membership",
    metadata,
  });
}

export async function approveMembership(input: {
  id: string;
  role: "editor" | "viewer";
}) {
  const parsed = z
    .object({ id: z.string().uuid(), role: roleEnum })
    .safeParse(input);
  if (!parsed.success) return { error: "잘못된 입력" };

  const master = await requireMaster();
  const supabase = await createServerClient();

  const { data: updated, error } = await supabase
    .from("memberships")
    .update({
      status: "active",
      role: parsed.data.role,
      approved_at: new Date().toISOString(),
      approved_by: master.userId,
    })
    .eq("id", parsed.data.id)
    .eq("group_id", master.groupId)
    .eq("status", "pending")
    .select("id")
    .single();
  if (error || !updated) return { error: error?.message ?? "승인 실패" };

  await logAudit(master.groupId, master.userId, "member_approved", updated.id, {
    role: parsed.data.role,
  });
  revalidatePath("/settings/teachers");
  return {};
}

export async function denyMembership(input: { id: string }) {
  const master = await requireMaster();
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("memberships")
    .update({
      status: "removed",
      removed_at: new Date().toISOString(),
      removed_by: master.userId,
    })
    .eq("id", input.id)
    .eq("group_id", master.groupId)
    .eq("status", "pending");
  if (error) return { error: error.message };
  await logAudit(master.groupId, master.userId, "member_denied", input.id);
  revalidatePath("/settings/teachers");
  return {};
}

export async function changeRole(input: {
  id: string;
  role: "editor" | "viewer";
}) {
  const parsed = z
    .object({ id: z.string().uuid(), role: roleEnum })
    .safeParse(input);
  if (!parsed.success) return { error: "잘못된 입력" };
  const master = await requireMaster();
  const supabase = await createServerClient();

  const { error } = await supabase
    .from("memberships")
    .update({ role: parsed.data.role })
    .eq("id", parsed.data.id)
    .eq("group_id", master.groupId)
    .eq("status", "active")
    .neq("role", "master");
  if (error) return { error: error.message };

  await logAudit(master.groupId, master.userId, "role_changed", parsed.data.id, {
    new_role: parsed.data.role,
  });
  revalidatePath("/settings/teachers");
  return {};
}

export async function removeMembership(input: { id: string }) {
  const master = await requireMaster();
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("memberships")
    .update({
      status: "removed",
      removed_at: new Date().toISOString(),
      removed_by: master.userId,
    })
    .eq("id", input.id)
    .eq("group_id", master.groupId)
    .eq("status", "active")
    .neq("role", "master");
  if (error) return { error: error.message };

  await logAudit(master.groupId, master.userId, "member_removed", input.id);
  revalidatePath("/settings/teachers");
  return {};
}
