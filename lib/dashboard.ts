import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership } from "@/lib/memberships";
import { maskPhone } from "@/lib/students";
import { displayStatus, type AttStatus, type BoardRecord } from "@/lib/attendance-cycle";

export type DashboardStudentEntry = { name: string; gender: string | null; grade: number; className: string | null; reason: string | null };

// 연락필요(미확인) 학생 연락처
export type ContactEntry = {
  name: string;
  gender: string | null;
  grade: number;
  className: string | null;
  phoneSelf: string | null;
  phoneGuardian: string | null;
  guardianRelation: string | null;
};

// 이번 달 생일자
export type BirthdayEntry = {
  name: string;
  gender: string | null;
  grade: number;
  className: string | null;
  month: number;
  day: number;
  isToday: boolean;
};

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

export type DashboardData = {
  summary: DashboardSummary | null;
  canCall: boolean;
  contact: ContactEntry[];
  birthdays: BirthdayEntry[];
};

// 지난(최신) 예배 출석 요약 + 연락필요 + 이번달 생일. 세션이 없어도 생일은 반환(summary만 null).
export async function loadDashboard(): Promise<DashboardData> {
  const m = await requireCurrentMembership();
  const supabase = await createServerClient();
  const mask = m.role === "viewer";
  const canCall = m.role !== "viewer";

  // 재적 학생 + 반 (생일/연락처에 항상 필요)
  // deleted_at만 필터 → 출석판/기존 요약과 동일한 집합 유지. 졸업생은 생일 필터에서 제외.
  const { data: studentRows } = await supabase
    .from("students")
    .select("id, name, class_id, gender, grade, phone_self, phone_guardian, guardian_relation, birthday_month, birthday_day, graduated_at")
    .eq("group_id", m.groupId)
    .is("deleted_at", null);

  const { data: classRows } = await supabase
    .from("classes").select("id, name, display_order")
    .eq("group_id", m.groupId).order("display_order", { ascending: true });

  const classes = classRows ?? [];
  const classNameById = new Map<string, string>();
  for (const c of classes) classNameById.set(c.id, c.name);

  type Stud = {
    id: string; name: string; classId: string | null; gender: string | null; grade: number;
    phoneSelf: string | null; phoneGuardian: string | null; guardianRelation: string | null;
    birthdayMonth: number | null; birthdayDay: number | null; graduatedAt: string | null;
  };
  const students: Stud[] = (studentRows ?? []).map((s) => ({
    id: s.id, name: s.name, classId: s.class_id, gender: s.gender, grade: s.grade ?? 0,
    phoneSelf: s.phone_self, phoneGuardian: s.phone_guardian, guardianRelation: s.guardian_relation,
    birthdayMonth: s.birthday_month, birthdayDay: s.birthday_day, graduatedAt: s.graduated_at,
  }));

  // 이번 달/오늘 (KST 기준) — 서버에서만 계산해 hydration 불일치 방지
  const kst = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date()); // "YYYY-MM-DD"
  const [, kMonthStr, kDayStr] = kst.split("-");
  const todayMonth = Number(kMonthStr);
  const todayDay = Number(kDayStr);

  const birthdays: BirthdayEntry[] = students
    .filter((s) => s.graduatedAt == null && s.birthdayMonth === todayMonth && s.birthdayDay != null)
    .map((s) => ({
      name: s.name,
      gender: s.gender,
      grade: s.grade,
      className: s.classId ? classNameById.get(s.classId) ?? null : null,
      month: s.birthdayMonth!,
      day: s.birthdayDay!,
      isToday: s.birthdayMonth === todayMonth && s.birthdayDay === todayDay,
    }))
    .sort((a, b) => a.day - b.day || a.name.localeCompare(b.name, "ko"));

  // 최신 세션
  const { data: session } = await supabase
    .from("attendance_sessions").select("id, session_date, note")
    .eq("group_id", m.groupId)
    .order("session_date", { ascending: false })
    .limit(1).maybeSingle();

  if (!session) {
    return { summary: null, canCall, contact: [], birthdays };
  }

  // 해당 세션 레코드
  const records: Record<string, BoardRecord> = {};
  const { data: recRows } = await supabase
    .from("attendance_records").select("student_id, status, reason")
    .eq("session_id", session.id).eq("group_id", m.groupId);
  for (const r of recRows ?? []) {
    records[r.student_id] = { status: r.status as AttStatus, reason: r.reason };
  }

  // classId별 그룹핑 (null = 미배정)
  const byClass = new Map<string | null, Stud[]>();
  for (const s of students) {
    const key = s.classId ?? null;
    if (!byClass.has(key)) byClass.set(key, []);
    byClass.get(key)!.push(s);
  }

  let present = 0, reason = 0, unconfirmed = 0;
  const presentList: DashboardStudentEntry[] = [];
  const reasonList: DashboardStudentEntry[] = [];
  const unconfirmedList: DashboardStudentEntry[] = [];
  const contact: ContactEntry[] = [];
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
      else if (d === "unconfirmed") {
        unconfirmed++;
        unconfirmedList.push({ ...base, reason: null });
        contact.push({
          name: s.name, gender: s.gender, grade: s.grade, className,
          phoneSelf: mask ? maskPhone(s.phoneSelf) : s.phoneSelf,
          phoneGuardian: mask ? maskPhone(s.phoneGuardian) : s.phoneGuardian,
          guardianRelation: s.guardianRelation,
        });
      }
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
  contact.sort((a, b) => a.name.localeCompare(b.name, "ko"));

  const summary: DashboardSummary = {
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

  return { summary, canCall, contact, birthdays };
}
