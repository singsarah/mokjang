import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership } from "@/lib/memberships";

export function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  const parts = phone.split("-");
  if (parts.length === 3) {
    return `${parts[0]}-${"*".repeat(parts[1].length)}-${parts[2]}`;
  }
  if (/^\d{10,11}$/.test(phone)) {
    return `${phone.slice(0, 3)}${"*".repeat(phone.length - 7)}${phone.slice(-4)}`;
  }
  return phone
    .split("")
    .map((ch, i) => (i < 3 || ch === "-" ? ch : "*"))
    .join("");
}

export type RosterClass = { id: string; name: string; displayOrder: number };
export type RosterStudent = {
  id: string;
  name: string;
  grade: number | null;
  classId: string | null;
  phoneSelf: string | null;
  phoneGuardian: string | null;
  guardianRelation: string | null;
};

export async function loadRoster(opts?: { includeDeleted?: boolean }): Promise<{
  canEdit: boolean;
  groupId: string;
  classes: RosterClass[];
  students: RosterStudent[];
}> {
  const m = await requireCurrentMembership();
  const supabase = await createServerClient();
  const canEdit = m.role === "master" || m.role === "editor";

  const { data: classRows } = await supabase
    .from("classes")
    .select("id, name, display_order")
    .eq("group_id", m.groupId)
    .order("display_order", { ascending: true });

  let q = supabase
    .from("students")
    .select("id, name, grade, class_id, phone_self, phone_guardian, guardian_relation, deleted_at")
    .eq("group_id", m.groupId)
    .order("grade", { ascending: true })
    .order("name", { ascending: true });
  q = opts?.includeDeleted ? q.not("deleted_at", "is", null) : q.is("deleted_at", null);
  const { data: studentRows } = await q;

  const mask = m.role === "viewer";
  const students: RosterStudent[] = (studentRows ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    grade: s.grade,
    classId: s.class_id,
    phoneSelf: mask ? maskPhone(s.phone_self) : s.phone_self,
    phoneGuardian: mask ? maskPhone(s.phone_guardian) : s.phone_guardian,
    guardianRelation: s.guardian_relation,
  }));

  return {
    canEdit,
    groupId: m.groupId,
    classes: (classRows ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      displayOrder: c.display_order,
    })),
    students,
  };
}
