"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireCurrentMembership, type CurrentMembership } from "@/lib/memberships";
import type { AttStatus } from "@/lib/attendance";
import type { AttendanceExportSession, AttendanceExportStudent } from "@/lib/attendance-export";

const CLOSED_MSG = "마감된 출석이에요. 수정하려면 마스터가 마감을 해제해야 해요.";

async function requireEditor(): Promise<CurrentMembership> {
  const m = await requireCurrentMembership();
  if (m.role !== "master" && m.role !== "editor") throw new Error("편집 권한이 필요합니다");
  return m;
}

// 마감/해제는 감사 로그에 남긴다 — audit_log는 유저 INSERT 정책이 없으므로 서비스롤로만 기록.
async function logAudit(groupId: string, actorId: string, action: string, targetId: string) {
  const supabase = createServiceRoleClient();
  await supabase.from("audit_log").insert({
    group_id: groupId,
    actor_id: actorId,
    action,
    target_id: targetId,
    target_type: "attendance_session",
  });
}

// 해당 날짜 세션을 보장(없으면 임시 세션 생성)하고 id를 반환. 마감된 세션이면 error.
async function ensureOpenSessionId(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  groupId: string,
  userId: string,
  dateISO: string,
): Promise<{ id?: string; error?: string }> {
  const { data: existing } = await supabase
    .from("attendance_sessions").select("id, closed_at")
    .eq("group_id", groupId).eq("session_date", dateISO).maybeSingle();
  if (existing) {
    if (existing.closed_at) return { error: CLOSED_MSG };
    return { id: existing.id };
  }
  const { data: created, error } = await supabase
    .from("attendance_sessions")
    .insert({ group_id: groupId, session_date: dateISO, note: "주일예배", created_by: userId })
    .select("id").single();
  if (error) {
    // 동시 첫 기록 시 다른 편집자가 먼저 세션을 만들었을 수 있음 → 재조회.
    if (error.code === "23505") {
      const { data: race } = await supabase
        .from("attendance_sessions").select("id, closed_at")
        .eq("group_id", groupId).eq("session_date", dateISO).maybeSingle();
      if (race?.closed_at) return { error: CLOSED_MSG };
      return race ? { id: race.id } : { error: "세션 생성 실패" };
    }
    return { error: "세션 생성 실패" };
  }
  return { id: created.id };
}

export async function setAttendance(input: {
  dateISO: string;
  studentId: string;
  status: AttStatus;
  reason?: string | null;
}): Promise<{ error?: string }> {
  const m = await requireEditor();
  const supabase = await createServerClient();
  const ensured = await ensureOpenSessionId(supabase, m.groupId, m.userId, input.dateISO);
  if (!ensured.id) return { error: ensured.error ?? "세션 생성 실패" };
  const sessionId = ensured.id;

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
    // 마감된 세션만 — 임시(미마감) 세션은 아직 확정 전이므로 이력에 포함하지 않는다.
    supabase
      .from("attendance_sessions")
      .select("id, session_date")
      .eq("group_id", m.groupId)
      .not("closed_at", "is", null)
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
    .from("attendance_sessions").select("id, closed_at")
    .eq("group_id", m.groupId).eq("session_date", input.dateISO).maybeSingle();
  if (!session) return {}; // 세션 없으면 지울 것도 없음
  if (session.closed_at) return { error: CLOSED_MSG };
  const { error } = await supabase
    .from("attendance_records")
    .delete()
    .eq("session_id", session.id)
    .eq("student_id", input.studentId)
    .eq("group_id", m.groupId);
  if (error) return { error: error.message };

  // 마지막 기록까지 지워졌으면 임시 세션도 정리 — 실수로 눌렀다 되돌린 날이
  // 엑셀·대시보드에 빈 날짜로 남지 않게 한다.
  const { count } = await supabase
    .from("attendance_records")
    .select("id", { count: "exact", head: true })
    .eq("session_id", session.id);
  if ((count ?? 1) === 0) {
    await supabase
      .from("attendance_sessions")
      .delete()
      .eq("id", session.id)
      .eq("group_id", m.groupId)
      .is("closed_at", null);
  }

  revalidatePath("/attendance");
  return {};
}

// ── 마감(확정) 플로우 ─────────────────────────────────────────
// 마감된 세션만 통계·엑셀에 포함된다. 마감 후 기록은 잠기고(DB 트리거로도 강제),
// 마감 해제는 마스터만 가능하다.

export async function closeSession(input: { dateISO: string }): Promise<{ error?: string }> {
  const m = await requireEditor();
  const supabase = await createServerClient();
  const { data: updated, error } = await supabase
    .from("attendance_sessions")
    .update({ closed_at: new Date().toISOString(), closed_by: m.userId })
    .eq("group_id", m.groupId)
    .eq("session_date", input.dateISO)
    .is("closed_at", null)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!updated) return { error: "마감할 출석 기록이 없어요." };
  await logAudit(m.groupId, m.userId, "attendance_closed", updated.id);
  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  return {};
}

export async function reopenSession(input: { dateISO: string }): Promise<{ error?: string }> {
  const m = await requireCurrentMembership();
  if (m.role !== "master") return { error: "마감 해제는 마스터만 할 수 있어요." };
  const supabase = await createServerClient();
  const { data: updated, error } = await supabase
    .from("attendance_sessions")
    .update({ closed_at: null, closed_by: null })
    .eq("group_id", m.groupId)
    .eq("session_date", input.dateISO)
    .not("closed_at", "is", null)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!updated) return { error: "마감된 출석이 없어요." };
  await logAudit(m.groupId, m.userId, "attendance_reopened", updated.id);
  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  return {};
}

// 임시(미마감) 세션을 기록째 삭제 — 잘못 시작한 날을 통째로 되돌린다.
export async function deleteDraftSession(input: { dateISO: string }): Promise<{ error?: string }> {
  const m = await requireEditor();
  const supabase = await createServerClient();
  const { data: session } = await supabase
    .from("attendance_sessions").select("id, closed_at")
    .eq("group_id", m.groupId).eq("session_date", input.dateISO).maybeSingle();
  if (!session) return {};
  if (session.closed_at) return { error: "마감된 출석은 삭제할 수 없어요." };
  const { error } = await supabase
    .from("attendance_sessions")
    .delete()
    .eq("id", session.id)
    .eq("group_id", m.groupId);
  if (error) return { error: error.message };
  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  return {};
}
