import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership } from "@/lib/memberships";
import {
  CalendarMonthView,
  type BirthdayItem,
  type CalendarEventItem,
} from "@/components/calendar-month-panel";

// 오늘 (KST 기준, YYYY-MM-DD) — 서버 로컬 시간대에 의존하지 않음.
function kstTodayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
    new Date(),
  );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function shiftMonth(year: number, month: number, delta: number): string {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m: mParam } = await searchParams;
  const todayISO = kstTodayISO();
  const ym =
    mParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(mParam)
      ? mParam
      : todayISO.slice(0, 7);
  const [year, month] = ym.split("-").map(Number);

  const membership = await requireCurrentMembership();
  const canEdit = membership.role !== "viewer";
  const supabase = await createServerClient();

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const [
    { data: eventRows },
    { data: studentRows },
    { data: teacherRows },
    { data: classRows },
  ] = await Promise.all([
    supabase
      .from("calendar_events")
      .select("id, title, event_date, event_time, description")
      .eq("group_id", membership.groupId)
      .gte("event_date", `${ym}-01`)
      .lte("event_date", `${ym}-${pad(lastDay)}`)
      .order("event_date", { ascending: true })
      .order("event_time", { ascending: true, nullsFirst: true }),
    supabase
      .from("students")
      .select("id, name, birthday_day, gender, grade, class_id, photo_path")
      .eq("group_id", membership.groupId)
      .eq("birthday_month", month)
      .is("deleted_at", null)
      .is("graduated_at", null)
      .not("birthday_day", "is", null),
    supabase
      .from("teachers")
      .select("id, name, birthday_day")
      .eq("group_id", membership.groupId)
      .eq("birthday_month", month)
      .not("birthday_day", "is", null),
    supabase
      .from("classes")
      .select("id, name")
      .eq("group_id", membership.groupId),
  ]);

  const events: CalendarEventItem[] = (eventRows ?? []).map((e) => ({
    id: e.id,
    title: e.title,
    date: e.event_date,
    time: e.event_time ? e.event_time.slice(0, 5) : null, // "HH:MM:SS" → "HH:MM"
    description: e.description,
  }));

  const classNameById = new Map<string, string>();
  for (const c of classRows ?? []) classNameById.set(c.id, c.name);

  // 학생 사진: 비공개 버킷이라 서명 URL을 서버에서 일괄 생성 (학적부와 동일 패턴).
  const students = studentRows ?? [];
  const photoPaths = students
    .map((s) => s.photo_path)
    .filter((p): p is string => Boolean(p));
  const signedUrlByPath = new Map<string, string>();
  if (photoPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("student-photos")
      .createSignedUrls(photoPaths, 3600);
    for (const item of signed ?? []) {
      if (item.path && item.signedUrl) {
        signedUrlByPath.set(item.path, item.signedUrl);
      }
    }
  }

  const birthdays: BirthdayItem[] = [
    ...students.map((s) => ({
      id: s.id,
      name: s.name,
      day: s.birthday_day as number,
      who: "student" as const,
      gender: s.gender,
      grade: s.grade,
      className: s.class_id ? classNameById.get(s.class_id) ?? null : null,
      photoUrl: s.photo_path ? signedUrlByPath.get(s.photo_path) ?? null : null,
    })),
    ...(teacherRows ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      day: t.birthday_day as number,
      who: "teacher" as const,
      gender: null,
      grade: null,
      className: null,
      photoUrl: null,
    })),
  ].sort((a, b) => a.day - b.day || a.name.localeCompare(b.name, "ko"));

  const isThisMonth = todayISO.slice(0, 7) === ym;
  const todayDay = isThisMonth ? Number(todayISO.slice(8, 10)) : null;
  const defaultDate = isThisMonth ? todayISO : `${ym}-01`;

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const navBtn =
    "flex h-9 w-9 items-center justify-center rounded-btn border border-border bg-white text-sm text-ink shadow-sm transition hover:bg-card";

  return (
    <main className="min-h-screen bg-sky-soft pb-36">
      <div className="mx-auto max-w-md px-4 py-8">
        {/* 월 헤더 + 이동 */}
        <div className="flex items-center justify-between">
          <Link href={`/calendar?m=${prev}`} aria-label="이전 달" className={navBtn}>
            ◀
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl font-bold text-ink">
              {year}년 {month}월
            </h1>
            {!isThisMonth && (
              <Link
                href="/calendar"
                className="rounded-tag border border-border bg-white px-2 py-0.5 text-sm text-ink-muted transition hover:text-ink"
              >
                오늘
              </Link>
            )}
          </div>
          <Link href={`/calendar?m=${next}`} aria-label="다음 달" className={navBtn}>
            ▶
          </Link>
        </div>

        {/* 그리드 + 날짜 선택 팝업 + 이번 달 목록 (클라이언트) */}
        <CalendarMonthView
          month={ym}
          todayDay={todayDay}
          defaultDate={defaultDate}
          events={events}
          birthdays={birthdays}
          canEdit={canEdit}
          isMaster={membership.role === "master"}
        />
      </div>
    </main>
  );
}
