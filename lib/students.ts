import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership } from "@/lib/memberships";

export type RosterClass = { id: string; grade: number; name: string; displayOrder: number };
export type RosterStudent = {
  id: string;
  name: string;
  grade: number;
  classId: string | null;
  phoneSelf: string | null;
  phoneGuardian: string | null;
  guardianRelation: string | null;
};

export async function loadRoster(opts?: { includeDeleted?: boolean }): Promise<{
  canEdit: boolean;
  classes: RosterClass[];
  students: RosterStudent[];
}> {
  const m = await requireCurrentMembership();
  const supabase = await createServerClient();
  const canEdit = m.role === "master" || m.role === "editor";

  const { data: classRows } = await supabase
    .from("classes")
    .select("id, grade, name, display_order")
    .eq("group_id", m.groupId)
    .order("grade", { ascending: true })
    .order("display_order", { ascending: true });

  let q = supabase
    .from("students")
    .select("id, name, grade, class_id, phone_self, phone_guardian, guardian_relation, deleted_at")
    .eq("group_id", m.groupId)
    .order("grade", { ascending: true })
    .order("name", { ascending: true });
  q = opts?.includeDeleted ? q.not("deleted_at", "is", null) : q.is("deleted_at", null);
  const { data: studentRows } = await q;

  const students: RosterStudent[] = (studentRows ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    grade: s.grade,
    classId: s.class_id,
    phoneSelf: s.phone_self,
    phoneGuardian: s.phone_guardian,
    guardianRelation: s.guardian_relation,
  }));

  return {
    canEdit,
    classes: (classRows ?? []).map((c) => ({
      id: c.id,
      grade: c.grade,
      name: c.name,
      displayOrder: c.display_order,
    })),
    students,
  };
}
