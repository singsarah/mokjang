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

export async function createClass(input: {
  name: string;
  teacherName?: string | null;
}): Promise<{ error?: string; id?: string }> {
  const parsed = classSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const m = await requireEditor();
  const supabase = await createServerClient();
  // 새 반은 이름의 자연 순서(1-2반은 1-1반과 1-3반 사이) 자리에 끼워 넣는다.
  // 기존 반은 현재 표시 순서를 유지한 채 번호만 다시 매긴다(구데이터의 0 동률도 이때 정리됨).
  const { data: existingRows, error: listErr } = await supabase
    .from("classes")
    .select("id, name")
    .eq("group_id", m.groupId)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (listErr) return { error: listErr.message };
  const existing = existingRows ?? [];
  const naturalCompare = (a: string, b: string) =>
    a.localeCompare(b, "ko", { numeric: true });
  let pos = existing.findIndex((c) => naturalCompare(c.name, parsed.data.name) > 0);
  if (pos === -1) pos = existing.length;
  for (let i = 0; i < existing.length; i++) {
    const { error: orderErr } = await supabase
      .from("classes")
      .update({ display_order: i < pos ? i : i + 1 })
      .eq("id", existing[i]!.id)
      .eq("group_id", m.groupId);
    if (orderErr) return { error: orderErr.message };
  }
  const { data, error } = await supabase
    .from("classes")
    .insert({
      group_id: m.groupId,
      name: parsed.data.name,
      teacher_name: parsed.data.teacherName,
      display_order: pos,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "같은 이름의 반이 이미 있습니다" };
    return { error: error.message };
  }
  revalidatePath("/settings/roster/classes");
  revalidatePath("/settings/roster");
  return { id: data.id };
}

export async function updateClass(input: {
  id: string;
  name: string;
  teacherName?: string | null;
}): Promise<{ error?: string }> {
  const parsed = classSchema.safeParse({ name: input.name, teacherName: input.teacherName });
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const m = await requireEditor();
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("classes")
    .update({ name: parsed.data.name, teacher_name: parsed.data.teacherName })
    .eq("id", input.id)
    .eq("group_id", m.groupId);
  if (error) {
    if (error.code === "23505") return { error: "같은 이름의 반이 이미 있습니다" };
    return { error: error.message };
  }
  revalidatePath("/settings/roster/classes");
  revalidatePath("/settings/roster");
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

// 선택한 반들을 한 번에 삭제 — 반에 있던 학생은 미배정으로 이동(학생 자체는 유지).
export async function bulkDeleteClasses(input: {
  ids: string[];
}): Promise<{ error?: string; unassigned?: number }> {
  const m = await requireEditor();
  if (!input.ids.length) return {};
  const supabase = await createServerClient();
  const { data: moved, error: unassignErr } = await supabase
    .from("students")
    .update({ class_id: null, updated_at: new Date().toISOString() })
    .in("class_id", input.ids)
    .eq("group_id", m.groupId)
    .select("id");
  if (unassignErr) return { error: unassignErr.message };
  const { error } = await supabase
    .from("classes")
    .delete()
    .in("id", input.ids)
    .eq("group_id", m.groupId);
  if (error) return { error: error.message };
  revalidatePath("/settings/roster");
  revalidatePath("/settings/roster/classes");
  revalidatePath("/attendance");
  return { unassigned: moved?.length ?? 0 };
}

// 선택한 학생들을 특정 반(classId)으로 이동, classId=null이면 미배정("빼기").
export async function assignStudents(input: {
  studentIds: string[];
  classId: string | null;
}): Promise<{ error?: string }> {
  const m = await requireEditor();
  if (!input.studentIds.length) return {};
  const supabase = await createServerClient();

  // 대상 반이 이 그룹 소속인지 존재 검증(타 그룹 class_id 방지)
  if (input.classId !== null) {
    const { data: cls } = await supabase
      .from("classes").select("id").eq("id", input.classId).eq("group_id", m.groupId).maybeSingle();
    if (!cls) return { error: "반을 찾을 수 없습니다" };
  }

  const { error } = await supabase
    .from("students")
    .update({ class_id: input.classId, updated_at: new Date().toISOString() })
    .in("id", input.studentIds)
    .eq("group_id", m.groupId);
  if (error) return { error: error.message };
  revalidatePath("/settings/roster");
  revalidatePath("/settings/roster/classes");
  return {};
}

// 그룹 전체 반 배정 초기화 — 모든 학생을 미배정으로 (반 자체는 유지).
export async function unassignAllStudents(): Promise<{ error?: string; cleared?: number }> {
  const m = await requireEditor();
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("students")
    .update({ class_id: null, updated_at: new Date().toISOString() })
    .eq("group_id", m.groupId)
    .not("class_id", "is", null)
    .select("id");
  if (error) return { error: error.message };
  revalidatePath("/settings/roster");
  revalidatePath("/settings/roster/classes");
  revalidatePath("/attendance");
  return { cleared: data?.length ?? 0 };
}
