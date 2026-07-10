"use client";

import { useState, useTransition } from "react";
import { exportTeachers } from "@/app/actions/teachers";
import { TEACHER_EXPORT_HEADERS, teacherExportRow } from "@/lib/roster-export";

// 다운로드 파일명용 KST 날짜(YYYY-MM-DD).
function kstDateStr(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

export function TeacherExportButton() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function onClick() {
    setError(undefined);
    startTransition(async () => {
      const res = await exportTeachers();
      if (res.error || !res.rows) {
        setError(res.error ?? "다운로드에 실패했습니다");
        return;
      }
      const XLSX = await import("xlsx");
      const aoa = [TEACHER_EXPORT_HEADERS, ...res.rows.map(teacherExportRow)];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      // 시트 이름에 "교사"가 포함돼야 함(다시 업로드할 때 시트 자동 선택 규칙과 동일).
      XLSX.utils.book_append_sheet(wb, ws, "교사");
      XLSX.writeFile(wb, `교사명단_${kstDateStr()}.xlsx`);
    });
  }

  return (
    <span className="flex w-full flex-col">
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className="w-full rounded-btn border border-border bg-white px-2 py-2 text-center text-sm text-ink shadow-sm transition hover:bg-card disabled:opacity-50"
      >
        {isPending ? "내려받는 중…" : "엑셀 다운로드"}
      </button>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </span>
  );
}
