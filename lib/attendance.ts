import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership } from "@/lib/memberships";

export type AttStatus = "present" | "absent_with_reason" | "unconfirmed";

// 탭 순환: 미체크(null) → 출석 → 미확인(사유칸) → 미체크
export function nextStatusOnTap(current: AttStatus | null): AttStatus | null {
  if (current === null) return "present";
  if (current === "present") return "unconfirmed";
  return null; // unconfirmed / absent_with_reason → 미체크
}

// 사유 입력값으로 결석 세부 상태 결정
export function statusForReason(reason: string): "absent_with_reason" | "unconfirmed" {
  return reason.trim() ? "absent_with_reason" : "unconfirmed";
}

export type BoardStudent = { id: string; name: string; classId: string | null };
export type BoardClass = { id: string; name: string; teacherName: string | null };
export type BoardRecord = { status: AttStatus; reason: string | null };

export async function loadBoard(dateISO: string): Promise<{
  canEdit: boolean;
  date: string;
  note: string;
  classes: BoardClass[];
  students: BoardStudent[];
  records: Record<string, BoardRecord>;
}> {
  const m = await requireCurrentMembership();
  const supabase = await createServerClient();
  const canEdit = m.role === "master" || m.role === "editor";

  const { data: classRows } = await supabase
    .from("classes").select("id, name, teacher_name, display_order")
    .eq("group_id", m.groupId).order("display_order", { ascending: true });

  const { data: studentRows } = await supabase
    .from("students").select("id, name, class_id")
    .eq("group_id", m.groupId).is("deleted_at", null).order("name", { ascending: true });

  // 해당 날짜 세션 + 레코드
  const { data: session } = await supabase
    .from("attendance_sessions").select("id, note")
    .eq("group_id", m.groupId).eq("session_date", dateISO).maybeSingle();

  const records: Record<string, BoardRecord> = {};
  if (session) {
    const { data: recRows } = await supabase
      .from("attendance_records").select("student_id, status, reason")
      .eq("session_id", session.id)
      .eq("group_id", m.groupId);
    for (const r of recRows ?? []) {
      records[r.student_id] = { status: r.status as AttStatus, reason: r.reason };
    }
  }

  return {
    canEdit,
    date: dateISO,
    note: session?.note ?? "주일예배",
    classes: (classRows ?? []).map((c) => ({ id: c.id, name: c.name, teacherName: c.teacher_name })),
    students: (studentRows ?? []).map((s) => ({ id: s.id, name: s.name, classId: s.class_id })),
    records,
  };
}
