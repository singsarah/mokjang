"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership, type CurrentMembership } from "@/lib/memberships";
import { minuteSchema, type MinuteInput, type MinuteParsed } from "@/lib/validation/minutes";

// 회의록 쓰기는 편집 권한 이상(master/editor) — 일정·출석과 동일 규칙.
async function requireEditor(): Promise<CurrentMembership> {
  const m = await requireCurrentMembership();
  if (m.role !== "master" && m.role !== "editor")
    throw new Error("편집 권한이 필요합니다");
  return m;
}

function toRow(d: MinuteParsed) {
  return {
    title: d.title,
    meeting_date: d.date,
    content: d.content,
  };
}

export async function createMinute(
  input: MinuteInput,
): Promise<{ error?: string; id?: string }> {
  const parsed = minuteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const m = await requireEditor();
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("meeting_minutes")
    .insert({
      group_id: m.groupId,
      ...toRow(parsed.data),
      created_by: m.userId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/minutes");
  return { id: data.id };
}

export async function updateMinute(
  input: { id: string } & MinuteInput,
): Promise<{ error?: string }> {
  const parsed = minuteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  if (!input.id) return { error: "잘못된 요청" };
  const m = await requireEditor();
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("meeting_minutes")
    .update({ ...toRow(parsed.data), updated_at: new Date().toISOString() })
    .eq("id", input.id)
    .eq("group_id", m.groupId);
  if (error) return { error: error.message };
  revalidatePath("/minutes");
  return {};
}

export async function deleteMinute(input: { id: string }): Promise<{ error?: string }> {
  if (!input?.id) return { error: "잘못된 요청" };
  const m = await requireEditor();
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("meeting_minutes")
    .delete()
    .eq("id", input.id)
    .eq("group_id", m.groupId);
  if (error) return { error: error.message };
  revalidatePath("/minutes");
  return {};
}
