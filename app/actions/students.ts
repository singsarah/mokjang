"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership, type CurrentMembership } from "@/lib/memberships";
import { studentSchema, type StudentInput } from "@/lib/validation/student";

async function requireEditor(): Promise<CurrentMembership> {
  const m = await requireCurrentMembership();
  if (m.role !== "master" && m.role !== "editor") throw new Error("편집 권한이 필요합니다");
  return m;
}

function toRow(d: StudentInput) {
  return {
    name: d.name,
    grade: d.grade,
    class_id: d.classId,
    birthday_month: d.birthdayMonth,
    birthday_day: d.birthdayDay,
    birthday_year: d.birthdayYear,
    phone_self: d.phoneSelf,
    phone_guardian: d.phoneGuardian,
    guardian_relation: d.guardianRelation,
    guardian_relation_other: d.guardianRelationOther,
    school: d.school,
    note: d.note,
    photo_path: d.photoPath,
  };
}

export async function createStudent(
  input: StudentInput,
): Promise<{ error?: string; id?: string }> {
  const parsed = studentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const m = await requireEditor();
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("students")
    .insert({ group_id: m.groupId, ...toRow(parsed.data) })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/settings/roster");
  return { id: data.id };
}

export async function updateStudent(
  input: { id: string } & StudentInput,
): Promise<{ error?: string }> {
  const parsed = studentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  if (!input.id) return { error: "잘못된 요청" };
  const m = await requireEditor();
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("students")
    .update({ ...toRow(parsed.data), updated_at: new Date().toISOString() })
    .eq("id", input.id)
    .eq("group_id", m.groupId);
  if (error) return { error: error.message };
  revalidatePath("/settings/roster");
  revalidatePath(`/settings/roster/${input.id}`);
  return {};
}

export async function softDeleteStudent(input: { id: string }): Promise<{ error?: string }> {
  const m = await requireEditor();
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("students")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", input.id)
    .eq("group_id", m.groupId)
    .is("deleted_at", null);
  if (error) return { error: error.message };
  revalidatePath("/settings/roster");
  revalidatePath("/settings/roster/hidden");
  return {};
}

export async function restoreStudent(input: { id: string }): Promise<{ error?: string }> {
  const m = await requireEditor();
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("students")
    .update({ deleted_at: null })
    .eq("id", input.id)
    .eq("group_id", m.groupId);
  if (error) return { error: error.message };
  revalidatePath("/settings/roster");
  revalidatePath("/settings/roster/hidden");
  return {};
}
