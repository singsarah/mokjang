import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership } from "@/lib/memberships";
import { maskPhone } from "@/lib/students";
import { bucketSessionsByWeek, displayStatus, trendWeekStarts, type AttStatus, type BoardRecord } from "@/lib/attendance-cycle";

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

// 출석 추이 그래프용 주간 데이터 — 이번주 포함 직전 4주 고정(오름차순).
// date는 그 주 대표(마지막 마감) 세션 날짜, null이면 그 주에 마감된 출석 없음(빈 칸).
export type TrendPoint = {
  weekStart: string; // 그 주 일요일
  date: string | null;
  present: number;
  reason: number; // 사유결석
  unconfirmed: number; // 미확인
  total: number; // 현재 재적
};

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

  // 출석 추이: 이번주 포함 직전 4주 고정. 각 주는 그 주 마지막 "마감된" 세션 기준
  // (미마감은 아직 확정 전이라 제외 — 마감 전인 주는 빈 칸). 총원은 현재 재적 인원으로 통일.
  const closedSessions = sessions.filter((s) => s.closed_at != null);
  const buckets = bucketSessionsByWeek(trendWeekStarts(kst), closedSessions);
  const trendIds = buckets.flatMap((b) => (b.session ? [b.session.id] : []));

  // 대표 세션(최대 4개)의 기록을 status 포함 한 번에 조회 → 세션별 records 맵.
  const recordsBySession = new Map<string, Record<string, BoardRecord>>();
  if (trendIds.length > 0) {
    const { data: trendRecRows } = await supabase
      .from("attendance_records")
      .select("session_id, student_id, status, reason")
      .in("session_id", trendIds)
      .eq("group_id", m.groupId);
    for (const r of trendRecRows ?? []) {
      if (!recordsBySession.has(r.session_id)) recordsBySession.set(r.session_id, {});
      recordsBySession.get(r.session_id)![r.student_id] = { status: r.status as AttStatus, reason: r.reason };
    }
  }

  // 요약 카드와 동일한 의미론(반별 active 판정 + displayStatus)으로 카운트만 집계.
  function countStats(records: Record<string, BoardRecord>): { present: number; reason: number; unconfirmed: number } {
    let present = 0, reason = 0, unconfirmed = 0;
    for (const grp of order) {
      const list = byClass.get(grp.key) ?? [];
      const classActive = list.some((s) => Boolean(records[s.id]));
      for (const s of list) {
        const d = displayStatus(records[s.id], classActive);
        if (d === "present") present++;
        else if (d === "absent_with_reason") reason++;
        else if (d === "unconfirmed") unconfirmed++;
      }
    }
    return { present, reason, unconfirmed };
  }

  const trend: TrendPoint[] = buckets.map((b) => {
    if (!b.session) {
      return { weekStart: b.weekStart, date: null, present: 0, reason: 0, unconfirmed: 0, total: students.length };
    }
    const stats = countStats(recordsBySession.get(b.session.id) ?? {});
    return { weekStart: b.weekStart, date: b.session.session_date, ...stats, total: students.length };
  });

  return { summary, canCall, contact, birthdays, trend, unclosedDates };
}
