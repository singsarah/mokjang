"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership, type CurrentMembership } from "@/lib/memberships";
import { classSchema } from "@/lib/validation/student";

async function requireEditor(): Promise<CurrentMembership> {
  const m = await requireCurrentMembership();
  if (m.role !== "master" && m.role !== "editor") throw new Error("편집 권한이 필요합니다");
  return m;
}

export async function createClass(input: { grade: number; name: string }): Promise<{ error?: string; id?: string }> {
  const parsed = classSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const m = await requireEditor();
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("classes")
    .insert({ group_id: m.groupId, grade: parsed.data.grade, name: parsed.data.name })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "같은 학년에 같은 이름의 반이 있습니다" };
    return { error: error.message };
  }
  revalidatePath("/settings/roster/classes");
  revalidatePath("/settings/roster");
  return { id: data.id };
}

export async function renameClass(input: { id: string; name: string }): Promise<{ error?: string }> {
  const name = input.name?.trim();
  if (!name) return { error: "반 이름을 입력해주세요" };
  const m = await requireEditor();
  const supabase = await createServerClient();
  const { error } = await supabase.from("classes").update({ name }).eq("id", input.id).eq("group_id", m.groupId);
  if (error) return { error: error.message };
  revalidatePath("/settings/roster/classes");
  return {};
}

export async function reorderClasses(input: { orderedIds: string[] }): Promise<{ error?: string }> {
  const m = await requireEditor();
  const supabase = await createServerClient();
  for (let i = 0; i < input.orderedIds.length; i++) {
    const { error } = await supabase
      .from("classes")
      .update({ display_order: i })
      .eq("id", input.orderedIds[i])
      .eq("group_id", m.groupId);
    if (error) return { error: error.message };
  }
  revalidatePath("/settings/roster/classes");
  return {};
}

export async function deleteClass(input: { id: string }): Promise<{ error?: string }> {
  const m = await requireEditor();
  const supabase = await createServerClient();
  const { count } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("group_id", m.groupId)
    .eq("class_id", input.id)
    .is("deleted_at", null);
  if ((count ?? 0) > 0) return { error: "이 반에 학생이 있어 삭제할 수 없습니다. 학생을 먼저 이동하세요." };
  const { error } = await supabase.from("classes").delete().eq("id", input.id).eq("group_id", m.groupId);
  if (error) return { error: error.message };
  revalidatePath("/settings/roster/classes");
  return {};
}
