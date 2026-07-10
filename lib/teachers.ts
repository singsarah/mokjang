import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership } from "@/lib/memberships";

export type TeacherRow = {
  id: string;
  name: string;
  birthdayMonth: number | null;
  birthdayDay: number | null;
  birthdayYear: number | null;
  phone: string | null;
  kakaoId: string | null;
  duty: string | null;
  jobType: string | null;
  note: string | null;
  userId: string | null; // 연결된 가입 계정 (없으면 null)
};

const TEACHER_SELECT =
  "id, name, birthday_month, birthday_day, birthday_year, phone, kakao_id, duty, job_type, note, user_id";

type DbTeacher = {
  id: string;
  name: string;
  birthday_month: number | null;
  birthday_day: number | null;
  birthday_year: number | null;
  phone: string | null;
  kakao_id: string | null;
  duty: string | null;
  job_type: string | null;
  note: string | null;
  user_id: string | null;
};

function toTeacher(t: DbTeacher): TeacherRow {
  return {
    id: t.id,
    name: t.name,
    birthdayMonth: t.birthday_month,
    birthdayDay: t.birthday_day,
    birthdayYear: t.birthday_year,
    phone: t.phone,
    kakaoId: t.kakao_id,
    duty: t.duty,
    jobType: t.job_type,
    note: t.note,
    userId: t.user_id,
  };
}

// 교사 명단 로드. 가나다순 정렬(한국어 로케일).
export async function loadTeachers(): Promise<{
  isMaster: boolean;
  groupId: string;
  teachers: TeacherRow[];
}> {
  const m = await requireCurrentMembership();
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("teachers")
    .select(TEACHER_SELECT)
    .eq("group_id", m.groupId);
  const teachers = (data ?? [])
    .map((t) => toTeacher(t as DbTeacher))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  return { isMaster: m.role === "master", groupId: m.groupId, teachers };
}

export async function loadTeacher(id: string): Promise<TeacherRow | null> {
  const m = await requireCurrentMembership();
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("teachers")
    .select(TEACHER_SELECT)
    .eq("id", id)
    .eq("group_id", m.groupId)
    .maybeSingle();
  return data ? toTeacher(data as DbTeacher) : null;
}
