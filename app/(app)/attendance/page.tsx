import { loadBoard } from "@/lib/attendance";
import { AttendanceBoard } from "@/components/attendance-board";

function todayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const iso = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayISO();
  const board = await loadBoard(iso);
  return (
    <AttendanceBoard
      date={board.date}
      note={board.note}
      canEdit={board.canEdit}
      classes={board.classes}
      students={board.students}
      initialRecords={board.records}
    />
  );
}
