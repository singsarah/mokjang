import { loadBoard } from "@/lib/attendance";
import { AttendanceBoard } from "@/components/attendance-board";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  // 날짜가 없으면 loadBoard가 "가장 최근 모임일"(모임 요일 미설정 시 오늘)을 고른다.
  const iso = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  const board = await loadBoard(iso);
  return (
    <AttendanceBoard
      groupName={board.groupName}
      date={board.date}
      prevDate={board.prevDate}
      nextDate={board.nextDate}
      note={board.note}
      canEdit={board.canEdit}
      isMaster={board.isMaster}
      initialClosed={board.closedAt != null}
      classes={board.classes}
      students={board.students}
      initialRecords={board.records}
    />
  );
}
