// 출석부 전체 이력 "엑셀 다운로드" 행 매핑 — 순수 함수.
// app/actions/attendance.ts(서버 액션), 클라이언트 다운로드 버튼, tests/unit/attendance-export.test.ts 에서 import.
// 서버 전용 import(next/headers 등)는 추가하지 말 것 — roster-export.ts 관례와 동일.

export type AttendanceExportSession = { date: string }; // "YYYY-MM-DD", 오름차순으로 전달해야 함

export type AttendanceExportRecord = {
  status: "present" | "absent_with_reason" | "unconfirmed";
  reason: string | null;
};

export type AttendanceExportStudent = {
  name: string;
  grade: number | null;
  className: string | null;
  graduated: boolean; // 졸업생이면 이름 뒤에 "(졸업)" 표시
  hidden: boolean; // 숨김(삭제) 학생이면 이름 뒤에 "(숨김)" 표시
  recordsByDate: Record<string, AttendanceExportRecord | undefined>; // date("YYYY-MM-DD") → 그 세션의 기록
};

// 헤더: 이름/학년/반 + 세션 날짜들.
export function attendanceExportHeader(sessions: AttendanceExportSession[]): string[] {
  return ["이름", "학년", "반", ...sessions.map((s) => s.date)];
}

function nameWithSuffix(s: AttendanceExportStudent): string {
  if (s.graduated) return `${s.name}(졸업)`;
  if (s.hidden) return `${s.name}(숨김)`;
  return s.name;
}

// 날짜 한 칸: O(출석) / 사유 텍스트(사유결석, 비어있으면 "사유") / X(미확인) / ""(기록 없음).
function cell(rec: AttendanceExportRecord | undefined): string {
  if (!rec) return "";
  if (rec.status === "present") return "O";
  if (rec.status === "absent_with_reason") {
    const reason = rec.reason?.trim();
    return reason ? reason : "사유";
  }
  if (rec.status === "unconfirmed") return "X";
  return "";
}

export function attendanceExportRow(
  s: AttendanceExportStudent,
  sessions: AttendanceExportSession[],
): (string | number)[] {
  return [
    nameWithSuffix(s),
    s.grade ?? "",
    s.className ?? "",
    ...sessions.map((sess) => cell(s.recordsByDate[sess.date])),
  ];
}

// ── 하단 요약 행 ─────────────────────────────────────────────
// 날짜별 출석/사유결석/미확인 합계 + 학년별·반별 출석("출석 n/재적 m").
// 미확인 = X 기록 + (재적 학생인데 그 날 자기 반이 출석을 했는데 기록이 없는 경우)
//   — 출석판/대시보드의 표시 규칙(반이 활동했으면 미체크 = 미확인)과 동일.
// 학년별·반별 분모(m)는 현재 재적(졸업·숨김 제외) 기준.

function pad(label: string, values: (string | number)[]): (string | number)[] {
  return [label, "", "", ...values];
}

export function attendanceExportSummaryRows(
  students: AttendanceExportStudent[],
  sessions: AttendanceExportSession[],
): (string | number)[][] {
  if (sessions.length === 0 || students.length === 0) return [];

  const active = students.filter((s) => !s.graduated && !s.hidden); // 재적

  // 날짜별로 "활동한 반"(그 날 기록이 하나라도 있는 반) — 기록은 전체 학생 기준으로 판단.
  const activeClassesByDate = new Map<string, Set<string | null>>();
  for (const sess of sessions) {
    const set = new Set<string | null>();
    for (const s of students) {
      if (s.recordsByDate[sess.date]) set.add(s.className ?? null);
    }
    activeClassesByDate.set(sess.date, set);
  }

  const present: number[] = [];
  const reason: number[] = [];
  const unconfirmed: number[] = [];
  for (const sess of sessions) {
    let p = 0,
      r = 0,
      u = 0;
    const activeClasses = activeClassesByDate.get(sess.date)!;
    for (const s of students) {
      const rec = s.recordsByDate[sess.date];
      if (rec?.status === "present") p++;
      else if (rec?.status === "absent_with_reason") r++;
      else if (rec?.status === "unconfirmed") u++;
    }
    // 기록 없는 재적 학생: 그 날 자기 반이 활동했으면 미확인으로 집계.
    for (const s of active) {
      if (!s.recordsByDate[sess.date] && activeClasses.has(s.className ?? null)) u++;
    }
    present.push(p);
    reason.push(r);
    unconfirmed.push(u);
  }

  const rows: (string | number)[][] = [
    [],
    pad("출석 합계", present),
    pad("사유결석 합계", reason),
    pad("미확인 합계", unconfirmed),
  ];

  // 그룹별 "출석 n/재적 m" 행 생성기 (재적 학생 기준).
  function groupRows(keyOf: (s: AttendanceExportStudent) => string | null, suffix: string) {
    const groups = new Map<string, AttendanceExportStudent[]>();
    for (const s of active) {
      const key = keyOf(s);
      if (key == null) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b, "ko"))
      .map(([label, members]) =>
        pad(
          `${label}${suffix}`,
          sessions.map(
            (sess) =>
              `${members.filter((s) => s.recordsByDate[sess.date]?.status === "present").length}/${members.length}`,
          ),
        ),
      );
  }

  const gradeRows = groupRows((s) => (s.grade != null ? `${s.grade}학년` : null), " 출석");
  const classRows = groupRows((s) => s.className, " 출석");
  if (gradeRows.length > 0) rows.push([], ...gradeRows);
  if (classRows.length > 0) rows.push([], ...classRows);

  return rows;
}
