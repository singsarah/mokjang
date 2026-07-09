"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership, type CurrentMembership } from "@/lib/memberships";
import { eventSchema, type EventInput, type EventParsed } from "@/lib/validation/event";

// 일정 쓰기는 편집 권한 이상(master/editor) — 출석과 동일 규칙.
async function requireEditor(): Promise<CurrentMembership> {
  const m = await requireCurrentMembership();
  if (m.role !== "master" && m.role !== "editor")
    throw new Error("편집 권한이 필요합니다");
  return m;
}

function toRow(d: EventParsed) {
  return {
    title: d.title,
    event_date: d.date,
    event_time: d.time === "" ? null : d.time,
    description: d.description === "" ? null : d.description,
  };
}

export async function createEvent(
  input: EventInput,
): Promise<{ error?: string; id?: string }> {
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const m = await requireEditor();
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("calendar_events")
    .insert({
      group_id: m.groupId,
      ...toRow(parsed.data),
      source: "manual",
      created_by: m.userId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/calendar");
  return { id: data.id };
}

export async function updateEvent(
  input: { id: string } & EventInput,
): Promise<{ error?: string }> {
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  if (!input.id) return { error: "잘못된 요청" };
  const m = await requireEditor();
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("calendar_events")
    .update({ ...toRow(parsed.data), updated_at: new Date().toISOString() })
    .eq("id", input.id)
    .eq("group_id", m.groupId);
  if (error) return { error: error.message };
  revalidatePath("/calendar");
  return {};
}

export async function deleteEvent(input: { id: string }): Promise<{ error?: string }> {
  if (!input?.id) return { error: "잘못된 요청" };
  const m = await requireEditor();
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("id", input.id)
    .eq("group_id", m.groupId);
  if (error) return { error: error.message };
  revalidatePath("/calendar");
  return {};
}
