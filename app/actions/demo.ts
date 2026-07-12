"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { generateJoinCode } from "@/lib/join-code";
import { DEMO_EMAIL_DOMAIN, DEMO_EMAIL_PREFIX, isDemoEmail } from "@/lib/demo";

// ── 체험(demo) 모드 ───────────────────────────────────────────
// 로그인 화면의 "체험해 보기" → 가입 없이 1회용 계정 + 전용 체험 그룹을 만들고
// 더미 교사/학생/반/일정/지난 출석까지 채워서 바로 둘러볼 수 있게 한다.
// 체험 그룹은 방문자마다 분리(멀티테넌트 RLS 그대로)라 실제 데이터에 영향 없음.
// 48시간 지난 체험 계정·그룹은 다음 체험 시작 때 자동 정리.

const DEMO_TTL_MS = 48 * 60 * 60 * 1000;

// ── KST 날짜 헬퍼 (Vercel 서버는 UTC — 반드시 타임존 명시) ──
function kstTodayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}
function shiftISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}
function dayOfWeek(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 = 일요일
}
// 오늘보다 확실히 이전인 가장 최근 일요일 (오늘이 일요일이면 지난주 일요일).
// 오늘 날짜는 체험자가 직접 출석 체크를 해볼 수 있게 비워 둔다.
function lastSundayBefore(todayISO: string): string {
  let d = shiftISO(todayISO, -1);
  while (dayOfWeek(d) !== 0) d = shiftISO(d, -1);
  return d;
}
function nextSundayFrom(todayISO: string): string {
  let d = todayISO;
  while (dayOfWeek(d) !== 0) d = shiftISO(d, 1);
  return d;
}

type Admin = ReturnType<typeof createServiceRoleClient>;

// 48시간 지난 체험 계정과 그 계정이 만든 그룹을 정리 (실 데이터는 이메일 패턴으로 절대 안 건드림).
async function cleanupOldDemos(admin: Admin) {
  const { data: usersPage } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const cutoff = Date.now() - DEMO_TTL_MS;
  const oldIds = (usersPage?.users ?? [])
    .filter((u) => isDemoEmail(u.email) && new Date(u.created_at).getTime() < cutoff)
    .map((u) => u.id);
  if (oldIds.length === 0) return;
  await admin.from("groups").delete().in("created_by", oldIds);
  for (const id of oldIds) await admin.auth.admin.deleteUser(id);
}

// ── 더미 데이터 ──────────────────────────────────────────────

const DEMO_TEACHERS = [
  { name: "김은혜", duty: "부장", job_type: "직장인", phone: "91230001", kakao_id: "grace_kim" },
  { name: "이믿음", duty: "1반 담임", job_type: "직장인", phone: "91230002", kakao_id: "faith_lee" },
  { name: "박소망", duty: "2반 담임", job_type: "대학생", phone: "91230003", kakao_id: "hope_park" },
  { name: "정사랑", duty: "3반 담임", job_type: "직장인", phone: "91230004", kakao_id: "love_jung" },
  { name: "최기쁨", duty: "찬양팀", job_type: "대학생", phone: "91230005", kakao_id: "joy_choi" },
  { name: "한평안", duty: "회계", job_type: "직장인", phone: "91230006", kakao_id: "peace_han" },
];

// [이름, 성별, 반 인덱스(0=1반/1=2반/2=3반)] — 학년은 반 인덱스+1.
const DEMO_STUDENTS: [string, "female" | "male", number][] = [
  ["김하늘", "female", 0],
  ["이준서", "male", 0],
  ["박서연", "female", 0],
  ["최민준", "male", 0],
  ["정다은", "female", 1],
  ["강지호", "male", 1],
  ["윤채원", "female", 1],
  ["서도윤", "male", 1],
  ["한소율", "female", 2],
  ["오시우", "male", 2],
  ["임예은", "female", 2],
  ["신재원", "male", 2],
];

// 지난 3주 출석 패턴: 사유결석 {학생 인덱스: 사유}, 기록 없음(미확인) 인덱스 목록.
const DEMO_ATTENDANCE: { reasons: Record<number, string>; missing: number[] }[] = [
  { reasons: { 3: "가족 여행" }, missing: [7, 10] }, // 3주 전
  { reasons: { 5: "시험 기간" }, missing: [7] }, // 2주 전
  { reasons: { 9: "감기 몸살" }, missing: [7] }, // 지난주 — 서도윤은 계속 미확인(연락필요 예시)
];

async function seedDemoData(admin: Admin, groupId: string, userId: string) {
  const today = kstTodayISO();
  const [, monthStr, dayStr] = today.split("-");
  const thisMonth = Number(monthStr);
  const todayDay = Number(dayStr);

  // 반 3개 (담임 = 더미 교사 이름)
  const { data: classRows, error: classErr } = await admin
    .from("classes")
    .insert(
      ["1반", "2반", "3반"].map((name, i) => ({
        group_id: groupId,
        name,
        teacher_name: DEMO_TEACHERS[i + 1]!.name,
        display_order: i + 1,
      })),
    )
    .select("id, display_order");
  if (classErr || !classRows || classRows.length !== 3) throw classErr ?? new Error("class seed");
  const classIds = [...classRows].sort((a, b) => a.display_order - b.display_order).map((c) => c.id);

  // 교사 명단 (김은혜 생일 = 이번 달 → 대시보드 생일 카드에 보이게)
  const { error: teacherErr } = await admin.from("teachers").insert(
    DEMO_TEACHERS.map((t, i) => ({
      group_id: groupId,
      ...t,
      birthday_month: i === 0 ? thisMonth : ((i * 2 + 2) % 12) + 1,
      birthday_day: i === 0 ? Math.min(todayDay + 6, 28) : 5 + i * 3,
    })),
  );
  if (teacherErr) throw teacherErr;

  // 학생 12명 — 김하늘 생일 = 오늘(🎂), 정다은 = 이번 달
  const { data: studentRows, error: studentErr } = await admin
    .from("students")
    .insert(
      DEMO_STUDENTS.map(([name, gender, classIdx], i) => ({
        group_id: groupId,
        name,
        gender,
        grade: classIdx + 1,
        class_id: classIds[classIdx]!,
        birthday_month: i === 0 || i === 4 ? thisMonth : ((i * 3 + 1) % 12) + 1,
        birthday_day: i === 0 ? todayDay : i === 4 ? Math.min(todayDay + 4, 28) : 3 + i * 2,
        phone_self: `945500${String(i + 10)}`,
        phone_guardian: `8123400${String(i).padStart(2, "0")}`.slice(0, 8),
        guardian_relation: i % 2 === 0 ? "모" : "부",
        school: `${["한빛", "동산", "새길"][classIdx]}고`,
      })),
    )
    .select("id, name");
  if (studentErr || !studentRows) throw studentErr ?? new Error("student seed");
  // insert 순서 보존이 보장되지 않으므로 이름으로 다시 매핑.
  const idByName = new Map(studentRows.map((s) => [s.name, s.id]));
  const studentIds = DEMO_STUDENTS.map(([name]) => idByName.get(name)!);

  // 일정 (달력 체험용)
  const nextSun = nextSundayFrom(today);
  const { error: eventErr } = await admin.from("calendar_events").insert(
    [
      { date: nextSun, title: "주일예배", time: "11:30", description: "본당 3층" },
      { date: shiftISO(nextSun, 7), title: "주일예배", time: "11:30", description: "본당 3층" },
      { date: shiftISO(today, 3), title: "교사 회의", time: "20:00", description: "온라인(줌)" },
      { date: shiftISO(today, 9), title: "고등부 수련회", time: null, description: "1박 2일 · 은혜수양관" },
      { date: shiftISO(today, 10), title: "고등부 수련회", time: null, description: "1박 2일 · 은혜수양관" },
    ].map((e) => ({
      group_id: groupId,
      title: e.title,
      event_date: e.date,
      event_time: e.time,
      description: e.description,
      source: "manual" as const,
      created_by: userId,
    })),
  );
  if (eventErr) throw eventErr;

  // 회의록 샘플 (회의록 탭 체험용)
  const { error: minuteErr } = await admin.from("meeting_minutes").insert([
    {
      group_id: groupId,
      title: "교사 월례회의",
      meeting_date: shiftISO(today, -4),
      content:
        "참석: 김은혜, 이믿음, 박소망, 정사랑\n\n1. 수련회 준비\n- 장소: 은혜수양관 (1박 2일)\n- 조 편성은 반별로, 담임이 조장\n\n2. 결석 학생 심방\n- 서도윤: 이번 주 이믿음 선생님이 연락하기로\n\n다음 회의: 다음 달 첫째 주",
      created_by: userId,
    },
    {
      group_id: groupId,
      title: "여름 행사 기획 회의",
      meeting_date: shiftISO(today, -18),
      content:
        "참석: 김은혜, 최기쁨, 한평안\n\n- 여름 특별 찬양의 밤 일정 논의\n- 예산은 회계(한평안)가 다음 회의까지 정리\n- 홍보물은 최기쁨 담당",
      created_by: userId,
    },
  ]);
  if (minuteErr) throw minuteErr;

  // 지난 3주 주일 출석 (전부 마감 상태 → 통계·추이 그래프·엑셀에 바로 보임)
  const lastSun = lastSundayBefore(today);
  const sundays = [shiftISO(lastSun, -14), shiftISO(lastSun, -7), lastSun];
  const { data: sessionRows, error: sessionErr } = await admin
    .from("attendance_sessions")
    .insert(
      sundays.map((date) => ({
        group_id: groupId,
        session_date: date,
        note: "주일예배",
        created_by: userId,
        closed_at: new Date(`${date}T14:00:00+09:00`).toISOString(),
        closed_by: userId,
      })),
    )
    .select("id, session_date");
  if (sessionErr || !sessionRows) throw sessionErr ?? new Error("session seed");
  const sessionIdByDate = new Map(sessionRows.map((s) => [s.session_date, s.id]));

  const records: {
    group_id: string;
    session_id: string;
    student_id: string;
    status: string;
    reason: string | null;
    updated_by: string;
  }[] = [];
  sundays.forEach((date, w) => {
    const pattern = DEMO_ATTENDANCE[w]!;
    studentIds.forEach((studentId, i) => {
      if (pattern.missing.includes(i)) return; // 기록 없음 → 미확인(연락필요)
      const reason = pattern.reasons[i] ?? null;
      records.push({
        group_id: groupId,
        session_id: sessionIdByDate.get(date)!,
        student_id: studentId,
        status: reason ? "absent_with_reason" : "present",
        reason,
        updated_by: userId,
      });
    });
  });
  const { error: recordErr } = await admin.from("attendance_records").insert(records);
  if (recordErr) throw recordErr;
}

// ── 체험 시작 ────────────────────────────────────────────────

export async function startDemo(): Promise<{ error?: string }> {
  const admin = createServiceRoleClient();

  // 오래된 체험 계정 정리는 부가 작업 — 실패해도 체험 시작은 계속.
  try {
    await cleanupOldDemos(admin);
  } catch {
    /* noop */
  }

  const email = `${DEMO_EMAIL_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}${DEMO_EMAIL_DOMAIN}`;
  const password = crypto.randomUUID();

  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "체험 선생님" },
  });
  if (userErr || !created.user) return { error: "체험 공간을 만들지 못했어요. 다시 시도해주세요." };
  const userId = created.user.id;

  try {
    // 프로필: 가입 트리거가 만든 행에 이름 + 개인정보 동의(체험용 더미 데이터라 동의 게이트 생략).
    await admin
      .from("profiles")
      .update({ display_name: "체험 선생님", privacy_consent_at: new Date().toISOString() })
      .eq("id", userId);

    // 체험 그룹 + 마스터 멤버십 (join_code 충돌은 재시도)
    let groupId: string | null = null;
    for (let attempt = 0; attempt < 5 && !groupId; attempt++) {
      const { data: group, error: groupErr } = await admin
        .from("groups")
        .insert({ name: "체험 목장", join_code: generateJoinCode(), created_by: userId })
        .select("id")
        .single();
      if (groupErr) {
        if (groupErr.code === "23505") continue;
        throw groupErr;
      }
      groupId = group.id;
    }
    if (!groupId) throw new Error("join code");

    const { error: memErr } = await admin.from("memberships").insert({
      group_id: groupId,
      user_id: userId,
      role: "master",
      status: "active",
      approved_at: new Date().toISOString(),
      approved_by: userId,
    });
    if (memErr) throw memErr;

    await seedDemoData(admin, groupId, userId);
  } catch {
    // 반쯤 만들어진 체험 공간은 지워서 재시도 가능하게.
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return { error: "체험 공간을 만들지 못했어요. 다시 시도해주세요." };
  }

  // 브라우저 세션 로그인 (쿠키 기반 유저 클라이언트)
  const supabase = await createServerClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
  if (signInErr) return { error: "체험 로그인에 실패했어요. 다시 시도해주세요." };

  revalidatePath("/", "layout");
  redirect("/settings/teachers");
}
