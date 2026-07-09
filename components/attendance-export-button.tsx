"use client";

import { useState, useTransition } from "react";
import { exportAttendance } from "@/app/actions/attendance";
import { attendanceExportHeader, attendanceExportRow } from "@/lib/attendance-export";

// 다운로드 파일명용 KST 날짜(YYYY-MM-DD).
function kstDateStr(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

export function AttendanceExportButton() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function onClick() {
    setError(undefined);
    startTransition(async () => {
      const res = await exportAttendance();
      if (res.error || !res.sessions || !res.students) {
        setError(res.error ?? "다운로드에 실패했습니다");
        return;
      }
      const XLSX = await import("xlsx");
      const aoa = [
        attendanceExportHeader(res.sessions),
        ...res.students.map((s) => attendanceExportRow(s, res.sessions!)),
      ];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "출석부");
      XLSX.writeFile(wb, `출석부_${kstDateStr()}.xlsx`);
    });
  }

  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className="rounded-btn border border-border bg-white px-3 py-1.5 text-sm text-ink shadow-sm transition hover:bg-card disabled:opacity-50"
      >
        {isPending ? "내려받는 중…" : "출석부 다운로드"}
      </button>
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </span>
  );
}
