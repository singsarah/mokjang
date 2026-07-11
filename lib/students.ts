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

export type RosterClass = { id: string; name: string; teacherName: string | null; displayOrder: number };
export type RosterStudent = {
  id: string;
  name: string;
  grade: number | null;
  classId: string | null;
  birthdayMonth: number | null;
  phoneSelf: string | null;
  phoneGuardian: string | null;
  guardianRelation: string | null;
  guardianName: string | null;
  guardian2Relation: string | null;
  guardian2Name: string | null;
  guardian2Phone: string | null;
  school: string | null;
  baptism: string | null;
  kakaoId: string | null;
  address: string | null;
  familyNote: string | null;
  note: string | null;
  parentChatInvited: boolean;
  registrationSubmitted: boolean;
  gender: string | null;
};

// students 행 → RosterStudent 매핑 (viewer는 전화번호 마스킹).
type StudentRow = {
  id: string;
  name: string;
  grade: number | null;
  class_id: string | null;
  birthday_month: number | null;
  phone_self: string | null;
  phone_guardian: string | null;
  guardian_relation: string | null;
  guardian_name: string | null;
  guardian2_relation: string | null;
  guardian2_name: string | null;
  guardian2_phone: string | null;
  school: string | null;
  baptism: string | null;
  kakao_id: string | null;
  address: string | null;
  family_note: string | null;
  note: string | null;
  parent_chat_invited: boolean;
  registration_submitted: boolean;
  gender: string | null;
};

function toRosterStudent(s: StudentRow, mask: boolean): RosterStudent {
  return {
    id: s.id,
    name: s.name,
    grade: s.grade,
    classId: s.class_id,
    birthdayMonth: s.birthday_month,
    phoneSelf: mask ? maskPhone(s.phone_self) : s.phone_self,
    phoneGuardian: mask ? maskPhone(s.phone_guardian) : s.phone_guardian,
    guardianRelation: s.guardian_relation,
    guardianName: s.guardian_name,
    guardian2Relation: s.guardian2_relation,
    guardian2Name: s.guardian2_name,
    guardian2Phone: mask ? maskPhone(s.guardian2_phone) : s.guardian2_phone,
    school: s.school,
    baptism: s.baptism,
    kakaoId: s.kakao_id,
    address: s.address,
    familyNote: s.family_note,
    note: s.note,
    parentChatInvited: s.parent_chat_invited,
    registrationSubmitted: s.registration_submitted,
    gender: s.gender,
  };
}

const ROSTER_SELECT =
  "id, name, grade, class_id, birthday_month, phone_self, phone_guardian, guardian_relation, guardian_name, guardian2_relation, guardian2_name, guardian2_phone, school, baptism, kakao_id, address, family_note, note, parent_chat_invited, registration_submitted, gender";

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
    .select("id, name, teacher_name, display_order")
    .eq("group_id", m.groupId)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true }); // display_order가 같으면(구버전 데이터 전부 0) 만든 순서

  let q = supabase
    .from("students")
    .select(`${ROSTER_SELECT}, deleted_at, graduated_at`)
    .eq("group_id", m.groupId)
    .order("grade", { ascending: true })
    .order("name", { ascending: true });
  q = opts?.includeDeleted
    ? q.not("deleted_at", "is", null)
    : q.is("deleted_at", null).is("graduated_at", null);
  const { data: studentRows } = await q;

  const mask = m.role === "viewer";
  const students: RosterStudent[] = (studentRows ?? []).map((s) => toRosterStudent(s, mask));

  return {
    canEdit,
    groupId: m.groupId,
    classes: (classRows ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      teacherName: c.teacher_name,
      displayOrder: c.display_order,
    })),
    students,
  };
}

export async function loadGraduates(): Promise<{ canEdit: boolean; students: RosterStudent[] }> {
  const m = await requireCurrentMembership();
  const supabase = await createServerClient();
  const canEdit = m.role === "master" || m.role === "editor";
  const { data } = await supabase
    .from("students")
    .select(`${ROSTER_SELECT}, deleted_at`)
    .eq("group_id", m.groupId)
    .not("graduated_at", "is", null)
    .is("deleted_at", null)
    .order("name", { ascending: true });
  const mask = m.role === "viewer";
  const students: RosterStudent[] = (data ?? []).map((s) => toRosterStudent(s, mask));
  return { canEdit, students };
}
