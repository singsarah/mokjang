"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership, type CurrentMembership } from "@/lib/memberships";
import {
  absenceSchema,
  type AbsenceInput,
  type AbsenceParsed,
} from "@/lib/validation/absence";

// 출타는 viewer도 본인 것은 쓸 수 있다 — 역할 게이트 대신 소유권 게이트.
// 비마스터는 대상 교사 명단 행이 본인 계정에 연결돼 있어야 한다.
// RLS(마이그레이션 20260715000001)가 최종 방어선이고, 여기서는 친절한
// 한국어 에러를 위해 선검사한다.
async function checkOwnership(
  m: CurrentMembership,
  teacherId: string,
): Promise<string | null> {
  if (m.role === "master") return null;
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("teachers")
    .select("id")
    .eq("id", teacherId)
    .eq("group_id", m.groupId)
    .eq("user_id", m.userId)
    .maybeSingle();
  if (!data)
    return "본인 출타만 등록할 수 있어요. 내 계정이 교사 명단에 연결돼 있는지 확인해주세요.";
  return null;
}

function toRow(d: AbsenceParsed) {
  return {
    teacher_id: d.teacherId,
    start_date: d.startDate,
    end_date: d.endDate,
    reason: d.reason === "" ? null : d.reason,
  };
}

export async function createAbsence(
  input: AbsenceInput,
): Promise<{ error?: string; id?: string }> {
  const parsed = absenceSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const m = await requireCurrentMembership();
  const ownershipError = await checkOwnership(m, parsed.data.teacherId);
  if (ownershipError) return { error: ownershipError };
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("teacher_absences")
    .insert({
      group_id: m.groupId,
      ...toRow(parsed.data),
      created_by: m.userId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/calendar");
  return { id: data.id };
}

export async function updateAbsence(
  input: { id: string } & AbsenceInput,
): Promise<{ error?: string }> {
  const parsed = absenceSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  if (!input.id) return { error: "잘못된 요청" };
  const m = await requireCurrentMembership();
  const ownershipError = await checkOwnership(m, parsed.data.teacherId);
  if (ownershipError) return { error: ownershipError };
  const supabase = await createServerClient();
  // RLS가 소유권 밖의 행을 걸러내면 0행이 매치되고 error는 없다 — 행 수로 확인.
  const { data, error } = await supabase
    .from("teacher_absences")
    .update({ ...toRow(parsed.data), updated_at: new Date().toISOString() })
    .eq("id", input.id)
    .eq("group_id", m.groupId)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "수정 권한이 없거나 없는 출타예요" };
  revalidatePath("/calendar");
  return {};
}

export async function deleteAbsence(input: {
  id: string;
}): Promise<{ error?: string }> {
  if (!input?.id) return { error: "잘못된 요청" };
  const m = await requireCurrentMembership();
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("teacher_absences")
    .delete()
    .eq("id", input.id)
    .eq("group_id", m.groupId)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "삭제 권한이 없거나 없는 출타예요" };
  revalidatePath("/calendar");
  return {};
}
