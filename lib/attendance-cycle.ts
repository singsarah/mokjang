// 순수 출석 상태 로직 + 타입 — 클라이언트/서버 어디서나 import 가능.
// (lib/attendance.ts는 next/headers를 쓰는 서버 전용 loadBoard를 포함하므로
//  클라이언트 컴포넌트는 이 파일에서 import해야 함.)

export type AttStatus = "present" | "absent_with_reason" | "unconfirmed";

// 탭 순환: 미체크(null) → 출석 → 미확인(사유칸) → 미체크
export function nextStatusOnTap(current: AttStatus | null): AttStatus | null {
  if (current === null) return "present";
  if (current === "present") return "unconfirmed";
  return null; // unconfirmed / absent_with_reason → 미체크
}

// 사유 입력값으로 결석 세부 상태 결정
export function statusForReason(reason: string): "absent_with_reason" | "unconfirmed" {
  return reason.trim() ? "absent_with_reason" : "unconfirmed";
}

export type BoardStudent = { id: string; name: string; classId: string | null };
export type BoardClass = { id: string; name: string; teacherName: string | null };
export type BoardRecord = { status: AttStatus; reason: string | null };
