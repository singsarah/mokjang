"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership, type CurrentMembership } from "@/lib/memberships";
import type { AttStatus } from "@/lib/attendance";
import type { AttendanceExportSession, AttendanceExportStudent } from "@/lib/attendance-export";

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

// ── 출석부 전체 이력 엑셀 다운로드 ────────────────────────────
// 학적부 exportStudents()와 동일한 권한 정책: viewer는 전화번호가 마스킹되어 보이므로
// 원본 이력 전체 다운로드는 마스터/편집 교사만 허용.

export type ExportAttendanceResult = {
  sessions?: AttendanceExportSession[];
  students?: AttendanceExportStudent[];
  error?: string;
};

export async function exportAttendance(): Promise<ExportAttendanceResult> {
  const m = await requireCurrentMembership();
  if (m.role === "viewer") {
    return { error: "출석부 다운로드는 마스터/편집 교사만 할 수 있습니다" };
  }
  const supabase = await createServerClient();

  const [{ data: sessionRows }, { data: classRows }, { data: studentRows }] = await Promise.all([
    supabase
      .from("attendance_sessions")
      .select("id, session_date")
      .eq("group_id", m.groupId)
      .order("session_date", { ascending: true }),
    supabase.from("classes").select("id, name").eq("group_id", m.groupId),
    // 전체 학생(숨김·졸업 포함) — 재적이 아니어도 출석 기록이 있으면 이력에 남겨야 하므로
    // deleted_at/graduated_at 필터 없이 가져온 뒤 아래에서 조건에 맞게 걸러낸다.
    supabase
      .from("students")
      .select("id, name, grade, class_id, deleted_at, graduated_at")
      .eq("group_id", m.groupId),
  ]);

  const sessions = sessionRows ?? [];
  const classNameById = new Map((classRows ?? []).map((c) => [c.id, c.name]));

  const exportSessions: AttendanceExportSession[] = sessions.map((s) => ({ date: s.session_date }));

  const dateBySessionId = new Map(sessions.map((s) => [s.id, s.session_date]));
  const recordsByStudent = new Map<string, AttendanceExportStudent["recordsByDate"]>();

  if (sessions.length > 0) {
    const { data: recRows, error: recError } = await supabase
      .from("attendance_records")
      .select("student_id, session_id, status, reason")
      .eq("group_id", m.groupId)
      .in("session_id", sessions.map((s) => s.id));
    if (recError) return { error: recError.message };
    for (const r of recRows ?? []) {
      const date = dateBySessionId.get(r.session_id);
      if (!date) continue;
      if (!recordsByStudent.has(r.student_id)) recordsByStudent.set(r.student_id, {});
      recordsByStudent.get(r.student_id)![date] = {
        status: r.status as AttStatus,
        reason: r.reason,
      };
    }
  }

  const students: AttendanceExportStudent[] = (studentRows ?? [])
    .filter((s) => {
      const isActive = s.deleted_at == null && s.graduated_at == null;
      const hasRecord = recordsByStudent.has(s.id);
      return isActive || hasRecord;
    })
    .map((s) => ({
      name: s.name,
      grade: s.grade,
      className: s.class_id ? (classNameById.get(s.class_id) ?? null) : null,
      graduated: s.graduated_at != null,
      hidden: s.deleted_at != null && s.graduated_at == null,
      recordsByDate: recordsByStudent.get(s.id) ?? {},
    }))
    .sort((a, b) => (a.grade ?? 0) - (b.grade ?? 0) || a.name.localeCompare(b.name, "ko"));

  return { sessions: exportSessions, students };
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
