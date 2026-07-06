"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership, type CurrentMembership } from "@/lib/memberships";
import type { AttStatus } from "@/lib/attendance";

async function requireEditor(): Promise<CurrentMembership> {
  const m = await requireCurrentMembership();
  if (m.role !== "master" && m.role !== "editor") throw new Error("편집 권한이 필요합니다");
  return m;
}

// 해당 날짜 세션을 보장(없으면 생성)하고 id를 반환.
async function ensureSessionId(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  groupId: string,
  userId: string,
  dateISO: string,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("attendance_sessions").select("id")
    .eq("group_id", groupId).eq("session_date", dateISO).maybeSingle();
  if (existing) return existing.id;
  const { data: created, error } = await supabase
    .from("attendance_sessions")
    .insert({ group_id: groupId, session_date: dateISO, note: "주일예배", created_by: userId })
    .select("id").single();
  if (error) {
    // 동시 첫 기록 시 다른 편집자가 먼저 세션을 만들었을 수 있음 → 재조회.
    if (error.code === "23505") {
      const { data: race } = await supabase
        .from("attendance_sessions").select("id")
        .eq("group_id", groupId).eq("session_date", dateISO).maybeSingle();
      return race?.id ?? null;
    }
    return null;
  }
  return created.id;
}

export async function setAttendance(input: {
  dateISO: string;
  studentId: string;
  status: AttStatus;
  reason?: string | null;
}): Promise<{ error?: string }> {
  const m = await requireEditor();
  const supabase = await createServerClient();
  const sessionId = await ensureSessionId(supabase, m.groupId, m.userId, input.dateISO);
  if (!sessionId) return { error: "세션 생성 실패" };

  const { error } = await supabase
    .from("attendance_records")
    .upsert(
      {
        group_id: m.groupId,
        session_id: sessionId,
        student_id: input.studentId,
        status: input.status,
        reason: input.status === "absent_with_reason" ? (input.reason ?? null) : null,
        updated_by: m.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_id,student_id" },
    );
  if (error) return { error: error.message };
  revalidatePath("/attendance");
  return {};
}

export async function clearAttendance(input: {
  dateISO: string;
  studentId: string;
}): Promise<{ error?: string }> {
  const m = await requireEditor();
  const supabase = await createServerClient();
  const { data: session } = await supabase
    .from("attendance_sessions").select("id")
    .eq("group_id", m.groupId).eq("session_date", input.dateISO).maybeSingle();
  if (!session) return {}; // 세션 없으면 지울 것도 없음
  const { error } = await supabase
    .from("attendance_records")
    .delete()
    .eq("session_id", session.id)
    .eq("student_id", input.studentId)
    .eq("group_id", m.groupId);
  if (error) return { error: error.message };
  revalidatePath("/attendance");
  return {};
}
