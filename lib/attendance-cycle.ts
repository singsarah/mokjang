// 순수 출석 상태 로직 + 타입 — 클라이언트/서버 어디서나 import 가능.
// (lib/attendance.ts는 next/headers를 쓰는 서버 전용 loadBoard를 포함하므로
//  클라이언트 컴포넌트는 이 파일에서 import해야 함.)

// 저장 상태(DB). "unconfirmed"는 하위호환용 — 새 모델은 저장하지 않고 화면에서 계산.
export type AttStatus = "present" | "absent_with_reason" | "unconfirmed";

// 화면 표시 상태(미체크 포함).
export type DisplayStatus = "present" | "absent_with_reason" | "unconfirmed" | "unchecked";

export type BoardStudent = { id: string; name: string; classId: string | null };
export type BoardClass = { id: string; name: string; teacherName: string | null };
export type BoardRecord = { status: AttStatus; reason: string | null };

// 반이 "시작됨(active)"이면 기록 없는 학생은 미확인(빨강), 아니면 미체크(흰).
export function displayStatus(
  rec: BoardRecord | undefined,
  classActive: boolean,
): DisplayStatus {
  if (rec?.status === "present") return "present";
  if (rec?.status === "absent_with_reason") return "absent_with_reason";
  return classActive ? "unconfirmed" : "unchecked";
}

// 카드 탭: 출석이면 해제(기록 삭제 → 미확인/미체크), 아니면 출석.
export function tapAction(rec: BoardRecord | undefined): "present" | "clear" {
  return rec?.status === "present" ? "clear" : "present";
}

// 사유칸: 내용 있으면 사유결석, 비우면 해제(→ 미확인).
export type ReasonAction = { kind: "reason"; reason: string } | { kind: "clear" };
export function reasonAction(reason: string): ReasonAction {
  return reason.trim() ? { kind: "reason", reason } : { kind: "clear" };
}
