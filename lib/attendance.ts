import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership } from "@/lib/memberships";
import type { AttStatus, BoardClass, BoardRecord, BoardStudent } from "@/lib/attendance-cycle";

// 순수 로직/타입은 lib/attendance-cycle.ts로 분리(클라이언트 안전) — 기존 import 경로 유지용 재수출.
export * from "@/lib/attendance-cycle";

export async function loadBoard(dateISO: string): Promise<{
  canEdit: boolean;
  isMaster: boolean;
  date: string;
  note: string;
  closedAt: string | null;
  classes: BoardClass[];
  students: BoardStudent[];
  records: Record<string, BoardRecord>;
}> {
  const m = await requireCurrentMembership();
  const supabase = await createServerClient();
  const canEdit = m.role === "master" || m.role === "editor";
  const isMaster = m.role === "master";

  const { data: classRows } = await supabase
    .from("classes").select("id, name, teacher_name, display_order")
    .eq("group_id", m.groupId).order("display_order", { ascending: true })
    .order("created_at", { ascending: true }); // display_order 동률(구데이터 0)이면 만든 순서

  const { data: studentRows } = await supabase
    .from("students").select("id, name, class_id")
    .eq("group_id", m.groupId).is("deleted_at", null).order("name", { ascending: true });

  // 해당 날짜 세션 + 레코드
  const { data: session } = await supabase
    .from("attendance_sessions").select("id, note, closed_at")
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
    isMaster,
    date: dateISO,
    note: session?.note ?? "주일예배",
    closedAt: session?.closed_at ?? null,
    classes: (classRows ?? []).map((c) => ({ id: c.id, name: c.name, teacherName: c.teacher_name })),
    students: (studentRows ?? []).map((s) => ({ id: s.id, name: s.name, classId: s.class_id })),
    records,
  };
}
