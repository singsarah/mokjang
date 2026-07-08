import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership } from "@/lib/memberships";
import { displayStatus, type AttStatus, type BoardRecord } from "@/lib/attendance-cycle";

export type DashboardStudentEntry = { name: string; gender: string | null; grade: number; className: string | null; reason: string | null };

export type DashboardSummary = {
  date: string;
  note: string | null;
  total: number;
  present: number;
  reason: number;
  unconfirmed: number;
  presentList: DashboardStudentEntry[];
  reasonList: DashboardStudentEntry[];
  unconfirmedList: DashboardStudentEntry[];
  classSummaries: { name: string; present: number; total: number }[];
};

// 지난(최신) 예배 출석 요약. 세션이 하나도 없으면 null.
export async function loadDashboard(): Promise<DashboardSummary | null> {
  const m = await requireCurrentMembership();
  const supabase = await createServerClient();

  // 최신 세션
  const { data: session } = await supabase
    .from("attendance_sessions").select("id, session_date, note")
    .eq("group_id", m.groupId)
    .order("session_date", { ascending: false })
    .limit(1).maybeSingle();

  if (!session) return null;

  // 재적 학생 + 반 + 해당 세션 레코드 (loadBoard 패턴)
  const { data: studentRows } = await supabase
    .from("students").select("id, name, class_id, gender, grade")
    .eq("group_id", m.groupId).is("deleted_at", null);

  const { data: classRows } = await supabase
    .from("classes").select("id, name, display_order")
    .eq("group_id", m.groupId).order("display_order", { ascending: true });

  const records: Record<string, BoardRecord> = {};
  const { data: recRows } = await supabase
    .from("attendance_records").select("student_id, status, reason")
    .eq("session_id", session.id).eq("group_id", m.groupId);
  for (const r of recRows ?? []) {
    records[r.student_id] = { status: r.status as AttStatus, reason: r.reason };
  }

  const students = (studentRows ?? []).map((s) => ({ id: s.id, name: s.name, classId: s.class_id, gender: s.gender, grade: s.grade ?? 0 }));
  const classes = classRows ?? [];

  type Stud = { id: string; name: string; gender: string | null; grade: number };
  // classId별 그룹핑 (null = 미배정)
  const byClass = new Map<string | null, Stud[]>();
  for (const s of students) {
    const key = s.classId ?? null;
    if (!byClass.has(key)) byClass.set(key, []);
    byClass.get(key)!.push({ id: s.id, name: s.name, gender: s.gender, grade: s.grade });
  }

  let present = 0, reason = 0, unconfirmed = 0;
  const presentList: DashboardStudentEntry[] = [];
  const reasonList: DashboardStudentEntry[] = [];
  const unconfirmedList: DashboardStudentEntry[] = [];
  const classSummaries: { name: string; present: number; total: number }[] = [];

  // display_order 순서 + 미배정 맨 뒤
  const order: { key: string | null; name: string }[] = classes.map((c) => ({ key: c.id, name: c.name }));
  order.push({ key: null, name: "미배정" });

  for (const grp of order) {
    const list = byClass.get(grp.key) ?? [];
    if (list.length === 0) continue;
    const classActive = list.some((s) => Boolean(records[s.id]));
    const className = grp.key === null ? null : grp.name; // 미배정은 null
    let gPresent = 0;
    for (const s of list) {
      const d = displayStatus(records[s.id], classActive);
      const base = { name: s.name, gender: s.gender, grade: s.grade, className };
      if (d === "present") { present++; gPresent++; presentList.push({ ...base, reason: null }); }
      else if (d === "absent_with_reason") { reason++; reasonList.push({ ...base, reason: records[s.id]?.reason ?? null }); }
      else if (d === "unconfirmed") { unconfirmed++; unconfirmedList.push({ ...base, reason: null }); }
      // unchecked는 미포함
    }
    if (classActive) {
      classSummaries.push({ name: grp.name, present: gPresent, total: list.length });
    }
  }

  // 가나다순 정렬
  presentList.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  reasonList.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  unconfirmedList.sort((a, b) => a.name.localeCompare(b.name, "ko"));

  return {
    date: session.session_date,
    note: session.note,
    total: students.length,
    present,
    reason,
    unconfirmed,
    presentList,
    reasonList,
    unconfirmedList,
    classSummaries,
  };
}
