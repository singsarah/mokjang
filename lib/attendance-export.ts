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
