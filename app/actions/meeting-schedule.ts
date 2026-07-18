"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership, type CurrentMembership } from "@/lib/memberships";

async function requireMaster(): Promise<CurrentMembership> {
  const m = await requireCurrentMembership();
  if (m.role !== "master") throw new Error("마스터 권한이 필요합니다");
  return m;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function revalidate() {
  revalidatePath("/attendance");
  revalidatePath("/settings/group");
}

// 정기 모임 요일 설정 (0=일 … 6=토, 복수 선택)
export async function updateMeetingDays(input: { days: number[] }): Promise<{ error?: string }> {
  const m = await requireMaster();
  if (input.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    return { error: "요일 값이 올바르지 않아요." };
  }
  const days = [...new Set(input.days)].sort((a, b) => a - b);

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("groups").update({ meeting_days: days }).eq("id", m.groupId);
  if (error) return { error: "저장에 실패했어요. 다시 시도해주세요." };
  revalidate();
  return {};
}

// 정기 요일의 모임 이름 설정 — 예) 일요일="주일예배", 수요일="수요모임".
// 빈 문자열이면 그 요일 이름을 지운다(기본값으로 표시).
export async function updateMeetingDayName(input: {
  day: number;
  name: string;
}): Promise<{ error?: string }> {
  const m = await requireMaster();
  if (!Number.isInteger(input.day) || input.day < 0 || input.day > 6) {
    return { error: "요일 값이 올바르지 않아요." };
  }
  const name = input.name.trim().slice(0, 50);

  const supabase = await createServerClient();
  const { data: g, error: readError } = await supabase
    .from("groups").select("meeting_day_names").eq("id", m.groupId).single();
  if (readError) return { error: "저장에 실패했어요. 다시 시도해주세요." };

  const names = { ...((g?.meeting_day_names ?? {}) as Record<string, string>) };
  if (name) names[String(input.day)] = name;
  else delete names[String(input.day)];

  const { error } = await supabase
    .from("groups").update({ meeting_day_names: names }).eq("id", m.groupId);
  if (error) return { error: "저장에 실패했어요. 다시 시도해주세요." };
  revalidate();
  return {};
}

// 임시 모임 날짜 추가 (정기 요일 외 그때그때 모임) — 이름은 선택.
export async function addExtraMeeting(input: {
  dateISO: string;
  name?: string;
}): Promise<{ error?: string }> {
  const m = await requireMaster();
  if (!DATE_RE.test(input.dateISO)) return { error: "날짜 형식이 올바르지 않아요." };
  const name = input.name?.trim().slice(0, 50) || null;

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("extra_meetings")
    .insert({ group_id: m.groupId, meeting_date: input.dateISO, name, created_by: m.userId });
  if (error) {
    if (error.code === "23505") return { error: "이미 추가된 날짜예요." };
    return { error: "저장에 실패했어요. 다시 시도해주세요." };
  }
  revalidate();
  return {};
}

export async function removeExtraMeeting(input: { dateISO: string }): Promise<{ error?: string }> {
  const m = await requireMaster();
  if (!DATE_RE.test(input.dateISO)) return { error: "날짜 형식이 올바르지 않아요." };

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("extra_meetings").delete()
    .eq("group_id", m.groupId).eq("meeting_date", input.dateISO);
  if (error) return { error: "삭제에 실패했어요. 다시 시도해주세요." };
  revalidate();
  return {};
}
