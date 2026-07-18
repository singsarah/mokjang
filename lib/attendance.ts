import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership } from "@/lib/memberships";
import type { AttStatus, BoardClass, BoardRecord, BoardStudent } from "@/lib/attendance-cycle";
import {
  configuredMeetingName,
  hasSchedule,
  latestMeetingOnOrBefore,
  nextMeetingDate,
  prevMeetingDate,
  shiftDate,
  todayISOSeoul,
  weekdayOf,
  type MeetingDayNames,
} from "@/lib/meeting-schedule";

// 순수 로직/타입은 lib/attendance-cycle.ts로 분리(클라이언트 안전) — 기존 import 경로 유지용 재수출.
export * from "@/lib/attendance-cycle";

// 세션 기본 메모 — 일요일이면 주일예배, 그 외 요일은 모임.
export function defaultNote(dateISO: string): string {
  return weekdayOf(dateISO) === 0 ? "주일예배" : "모임";
}

// requestedISO 가 없으면(=URL에 날짜가 없으면) 기본 날짜는 "오늘 이하의 가장 최근 모임일".
// 예) 모임 요일이 일요일이고 오늘이 월요일이면 어제(일요일) 출석판이 뜬다.
// 모임 요일이 미설정인 그룹은 기존처럼 오늘 날짜 + 매일 이동.
export async function loadBoard(requestedISO: string | null): Promise<{
  canEdit: boolean;
  isMaster: boolean;
  groupName: string;
  date: string;
  prevDate: string | null;
  nextDate: string | null;
  note: string;
  closedAt: string | null;
  classes: BoardClass[];
  students: BoardStudent[];
  records: Record<string, BoardRecord>;
}> {
  const m = await requireCurrentMembership();
  const supabase = await createServerClient();
  const canEdit = m.role === "master" || m.role === "editor";
  const isMaster = m.role === "master";

  // 모임 일정: 정기 요일(+이름) + 임시 모임 날짜(+이름)
  const [{ data: groupRow }, { data: extraRows }] = await Promise.all([
    supabase.from("groups").select("meeting_days, meeting_day_names").eq("id", m.groupId).single(),
    supabase.from("extra_meetings").select("meeting_date, name").eq("group_id", m.groupId),
  ]);
  const meetingDays = groupRow?.meeting_days ?? [];
  const dayNames = (groupRow?.meeting_day_names ?? {}) as MeetingDayNames;
  const extraDates = (extraRows ?? []).map((r) => r.meeting_date);
  const extraNames: Record<string, string | null> = {};
  for (const r of extraRows ?? []) extraNames[r.meeting_date] = r.name;
  const scheduled = hasSchedule(meetingDays, extraDates);

  let dateISO = requestedISO;
  if (!dateISO) {
    const today = todayISOSeoul();
    if (scheduled) {
      // 과거 기록이 있는 날짜(임시로 URL로 기록했던 날 등)도 기본 날짜 후보에 포함.
      const { data: lastSession } = await supabase
        .from("attendance_sessions").select("session_date")
        .eq("group_id", m.groupId).lte("session_date", today)
        .order("session_date", { ascending: false }).limit(1).maybeSingle();
      const others = lastSession ? [...extraDates, lastSession.session_date] : extraDates;
      dateISO = latestMeetingOnOrBefore(today, meetingDays, others) ?? today;
    } else {
      dateISO = today;
    }
  }

  // ◀ ▶ 이동 대상: 모임일 사이만. 단, 출석 기록이 이미 있는 날짜는
  // 모임일이 아니어도 계속 접근 가능해야 하므로 인접 세션 날짜도 후보에 넣는다.
  let prevDate: string | null;
  let nextDate: string | null;
  if (scheduled) {
    const [{ data: prevSess }, { data: nextSess }] = await Promise.all([
      supabase.from("attendance_sessions").select("session_date")
        .eq("group_id", m.groupId).lt("session_date", dateISO)
        .order("session_date", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("attendance_sessions").select("session_date")
        .eq("group_id", m.groupId).gt("session_date", dateISO)
        .order("session_date", { ascending: true }).limit(1).maybeSingle(),
    ]);
    prevDate = prevMeetingDate(dateISO, meetingDays,
      prevSess ? [...extraDates, prevSess.session_date] : extraDates);
    nextDate = nextMeetingDate(dateISO, meetingDays,
      nextSess ? [...extraDates, nextSess.session_date] : extraDates);
  } else {
    prevDate = shiftDate(dateISO, -1);
    nextDate = shiftDate(dateISO, 1);
  }

  const { data: classRows } = await supabase
    .from("classes").select("id, name, teacher_name, display_order")
    .eq("group_id", m.groupId).order("display_order", { ascending: true })
    .order("created_at", { ascending: true }); // display_order 동률(구데이터 0)이면 만든 순서

  // 숨김(deleted_at)과 졸업생(graduated_at)은 출석판에 안 보인다.
  const { data: studentRows } = await supabase
    .from("students").select("id, name, class_id")
    .eq("group_id", m.groupId).is("deleted_at", null).is("graduated_at", null)
    .order("name", { ascending: true });

  // 해당 날짜 세션 + 레코드
  const { data: session } = await supabase
    .from("attendance_sessions").select("id, note, closed_at")
    .eq("group_id", m.groupId).eq("session_date", dateISO).maybeSingle();

  const records: Record<string, BoardRecord> = {};
  if (session) {
    const { data: recRows } = await supabase
      .from("attendance_records").select("student_id, status, reason")
      .eq("session_id", session.id)
      .eq("group_id", m.groupId);
    for (const r of recRows ?? []) {
      records[r.student_id] = { status: r.status as AttStatus, reason: r.reason };
    }
  }

  return {
    canEdit,
    isMaster,
    groupName: m.groupName,
    date: dateISO,
    prevDate,
    nextDate,
    // 조직 관리에서 설정한 이름이 있으면 그게 우선(이름 바꾸면 과거 세션도 즉시 반영),
    // 없으면 세션에 저장된 note → 기본값 순.
    note: configuredMeetingName(dateISO, dayNames, extraNames) ?? session?.note ?? defaultNote(dateISO),
    closedAt: session?.closed_at ?? null,
    classes: (classRows ?? []).map((c) => ({ id: c.id, name: c.name, teacherName: c.teacher_name })),
    students: (studentRows ?? []).map((s) => ({ id: s.id, name: s.name, classId: s.class_id })),
    records,
  };
}
