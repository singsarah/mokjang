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

// 이번 달 생일자 (학생 + 교사)
export type BirthdayEntry = {
  who: "student" | "teacher";
  name: string;
  gender: string | null; // 교사는 항상 null
  grade: number; // 교사는 0(미사용)
  className: string | null; // 교사는 항상 null
  month: number;
  day: number;
  isToday: boolean;
};

export type DashboardSummary = {
  date: string;
  note: string | null;
  closed: boolean; // 미마감(임시) 세션이면 false — 배지로 표시

  total: number;
  present: number;
  reason: number;
  unconfirmed: number;
  presentList: DashboardStudentEntry[];
  reasonList: DashboardStudentEntry[];
  unconfirmedList: DashboardStudentEntry[];
  classSummaries: { name: string; present: number; total: number }[];
  // 세션 넘기기(◀ ▶)용 — 인접 세션 날짜. 없으면 그쪽 끝(최신/최초).
  prevDate: string | null;
  nextDate: string | null;
};

// 출석 추이 그래프용 세션별 데이터 (최근 최대 12개, 날짜 오름차순).
export type TrendPoint = { date: string; present: number; total: number };

export type DashboardData = {
  summary: DashboardSummary | null;
  canCall: boolean;
  contact: ContactEntry[];
  birthdays: BirthdayEntry[];
  trend: TrendPoint[];
  // 지난 날짜인데 아직 마감하지 않은 세션 — 대시보드 상단 알림용 (오늘 진행 중인 건 제외).
  unclosedDates: string[];
};

type SessionStats = {
  present: number;
  reason: number;
  unconfirmed: number;
  presentList: DashboardStudentEntry[];
  reasonList: DashboardStudentEntry[];
  unconfirmedList: DashboardStudentEntry[];
  classSummaries: { name: string; present: number; total: number }[];
  contact: ContactEntry[];
};

// 지난 예배 출석 요약(선택한 세션, 기본값 최신) + 연락필요(항상 최신 세션 기준) + 이번달 생일(학생+교사)
// + 출석 추이(최근 12개 세션). 세션이 없어도 생일은 반환(summary/trend는 빈 값).
export async function loadDashboard(selectedDate?: string): Promise<DashboardData> {
  const m = await requireCurrentMembership();
  const supabase = await createServerClient();
  const mask = m.role === "viewer";
  const canCall = m.role !== "viewer";

  // 재적 학생 + 반 (생일/연락처/요약에 항상 필요)
  // 숨김(deleted_at)·졸업생(graduated_at) 제외 → 출석판과 동일한 집합 유지.
  const [{ data: studentRows }, { data: classRows }, { data: teacherRows }] = await Promise.all([
    supabase
      .from("students")
      .select("id, name, class_id, gender, grade, phone_self, phone_guardian, guardian_relation, birthday_month, birthday_day")
      .eq("group_id", m.groupId)
      .is("deleted_at", null)
      .is("graduated_at", null),
    supabase
      .from("classes").select("id, name, display_order")
      .eq("group_id", m.groupId).order("display_order", { ascending: true })
      .order("created_at", { ascending: true }), // display_order 동률(구데이터 0)이면 만든 순서
    supabase
      .from("teachers").select("name, birthday_month, birthday_day")
      .eq("group_id", m.groupId)
      .not("birthday_month", "is", null)
      .not("birthday_day", "is", null),
  ]);

  const classes = classRows ?? [];
  const classNameById = new Map<string, string>();
  for (const c of classes) classNameById.set(c.id, c.name);

  type Stud = {
    id: string; name: string; classId: string | null; gender: string | null; grade: number;
    phoneSelf: string | null; phoneGuardian: string | null; guardianRelation: string | null;
    birthdayMonth: number | null; birthdayDay: number | null;
  };
  const students: Stud[] = (studentRows ?? []).map((s) => ({
    id: s.id, name: s.name, classId: s.class_id, gender: s.gender, grade: s.grade ?? 0,
    phoneSelf: s.phone_self, phoneGuardian: s.phone_guardian, guardianRelation: s.guardian_relation,
    birthdayMonth: s.birthday_month, birthdayDay: s.birthday_day,
  }));

  // 이번 달/오늘 (KST 기준) — 서버에서만 계산해 hydration 불일치 방지
  const kst = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date()); // "YYYY-MM-DD"
  const [, kMonthStr, kDayStr] = kst.split("-");
  const todayMonth = Number(kMonthStr);
  const todayDay = Number(kDayStr);

  const studentBirthdays: BirthdayEntry[] = students
    .filter((s) => s.birthdayMonth === todayMonth && s.birthdayDay != null)
    .map((s) => ({
      who: "student" as const,
      name: s.name,
      gender: s.gender,
      grade: s.grade,
      className: s.classId ? classNameById.get(s.classId) ?? null : null,
      month: s.birthdayMonth!,
      day: s.birthdayDay!,
      isToday: s.birthdayMonth === todayMonth && s.birthdayDay === todayDay,
    }));

  const teacherBirthdays: BirthdayEntry[] = (teacherRows ?? [])
    .filter((t) => t.birthday_month === todayMonth && t.birthday_day != null)
    .map((t) => ({
      who: "teacher" as const,
      name: t.name,
      gender: null,
      grade: 0,
      className: null,
      month: t.birthday_month!,
      day: t.birthday_day!,
      isToday: t.birthday_month === todayMonth && t.birthday_day === todayDay,
    }));

  const birthdays: BirthdayEntry[] = [...studentBirthdays, ...teacherBirthdays].sort(
    (a, b) => a.day - b.day || a.name.localeCompare(b.name, "ko"),
  );

  // 전체 세션 (오름차순) — 세션 넘기기(◀▶)와 출석 추이 그래프 양쪽에 사용.
  // 미마감(임시) 세션도 넘겨보고 요약은 볼 수 있게 포함하되, 추이 그래프는 마감된 세션만.
  const { data: sessionRows } = await supabase
    .from("attendance_sessions").select("id, session_date, note, closed_at")
    .eq("group_id", m.groupId)
    .order("session_date", { ascending: true });
  const sessions = sessionRows ?? [];

  // 지난 날짜인데 미마감인 세션 (오늘 진행 중인 체크는 알림 대상 아님)
  const unclosedDates = sessions
    .filter((s) => s.closed_at == null && s.session_date < kst)
    .map((s) => s.session_date);

  if (sessions.length === 0) {
    return { summary: null, canCall, contact: [], birthdays, trend: [], unclosedDates };
  }

  const latestSession = sessions[sessions.length - 1]!;
  const selectedIdx = selectedDate
    ? sessions.findIndex((s) => s.session_date === selectedDate)
    : -1;
  const activeIdx = selectedIdx >= 0 ? selectedIdx : sessions.length - 1;
  const session = sessions[activeIdx]!;
  const prevDate = activeIdx > 0 ? sessions[activeIdx - 1]!.session_date : null;
  const nextDate = activeIdx < sessions.length - 1 ? sessions[activeIdx + 1]!.session_date : null;

  // classId별 그룹핑 (null = 미배정) — 세션 무관, 재사용.
  const byClass = new Map<string | null, Stud[]>();
  for (const s of students) {
    const key = s.classId ?? null;
    if (!byClass.has(key)) byClass.set(key, []);
    byClass.get(key)!.push(s);
  }
  // display_order 순서 + 미배정 맨 뒤
  const order: { key: string | null; name: string }[] = classes.map((c) => ({ key: c.id, name: c.name }));
  order.push({ key: null, name: "미배정" });

  function buildStats(records: Record<string, BoardRecord>): SessionStats {
    let present = 0, reason = 0, unconfirmed = 0;
    const presentList: DashboardStudentEntry[] = [];
    const reasonList: DashboardStudentEntry[] = [];
    const unconfirmedList: DashboardStudentEntry[] = [];
    const contact: ContactEntry[] = [];
    const classSummaries: { name: string; present: number; total: number }[] = [];

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

    presentList.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    reasonList.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    unconfirmedList.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    contact.sort((a, b) => a.name.localeCompare(b.name, "ko"));

    return { present, reason, unconfirmed, presentList, reasonList, unconfirmedList, classSummaries, contact };
  }

  async function fetchRecords(sessionId: string): Promise<Record<string, BoardRecord>> {
    const records: Record<string, BoardRecord> = {};
    const { data: recRows } = await supabase
      .from("attendance_records").select("student_id, status, reason")
      .eq("session_id", sessionId).eq("group_id", m.groupId);
    for (const r of recRows ?? []) {
      records[r.student_id] = { status: r.status as AttStatus, reason: r.reason };
    }
    return records;
  }

  const selectedRecords = await fetchRecords(session.id);
  const selectedStats = buildStats(selectedRecords);

  // 연락필요는 항상 최신 세션 기준(선택한 세션과 다르면 별도 조회).
  const contact = session.id === latestSession.id
    ? selectedStats.contact
    : buildStats(await fetchRecords(latestSession.id)).contact;

  const summary: DashboardSummary = {
    date: session.session_date,
    note: session.note,
    closed: session.closed_at != null,
    total: students.length,
    present: selectedStats.present,
    reason: selectedStats.reason,
    unconfirmed: selectedStats.unconfirmed,
    presentList: selectedStats.presentList,
    reasonList: selectedStats.reasonList,
    unconfirmedList: selectedStats.unconfirmedList,
    classSummaries: selectedStats.classSummaries,
    prevDate,
    nextDate,
  };

  // 출석 추이: 최근 최대 12개 "마감된" 세션의 출석(present) 인원 수. 미마감은 아직 확정 전이라 제외.
  // 총원은 현재 재적 인원(조회 시점 고정)으로 통일.
  const trendSessions = sessions.filter((s) => s.closed_at != null).slice(-12);
  const trend: TrendPoint[] = [];
  if (trendSessions.length > 0) {
    const trendIds = trendSessions.map((s) => s.id);
    const { data: presentRows } = await supabase
      .from("attendance_records")
      .select("session_id")
      .in("session_id", trendIds)
      .eq("status", "present")
      .eq("group_id", m.groupId);
    const presentBySession = new Map<string, number>();
    for (const r of presentRows ?? []) {
      presentBySession.set(r.session_id, (presentBySession.get(r.session_id) ?? 0) + 1);
    }
    for (const s of trendSessions) {
      trend.push({ date: s.session_date, present: presentBySession.get(s.id) ?? 0, total: students.length });
    }
  }

  return { summary, canCall, contact, birthdays, trend, unclosedDates };
}
