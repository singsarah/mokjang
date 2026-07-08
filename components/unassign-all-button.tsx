"use client";

import { useState, useTransition } from "react";
import { unassignAllStudents } from "@/app/actions/classes";

// 반 배정 전체 초기화 버튼 — 확인 후 모든 학생을 미배정으로.
export function UnassignAllButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();

  function onClick() {
    if (!window.confirm("모든 학생의 반 배정이 해제됩니다. (반 자체는 남아요)\n계속할까요?")) return;
    startTransition(async () => {
      const result = await unassignAllStudents();
      setMessage(
        result.error
          ? "초기화에 실패했어요. 다시 시도해주세요."
          : `학생 ${result.cleared ?? 0}명의 반 배정을 해제했어요.`,
      );
    });
  }

  return (
    <div className="mt-8">
      <button
        onClick={onClick}
        disabled={pending}
        className="w-full rounded-btn border border-danger/40 bg-white px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger/5 disabled:opacity-50"
      >
        {pending ? "초기화 중…" : "반 배정 전체 초기화"}
      </button>
      {message && <p className="mt-2 text-center text-sm text-ink-muted">{message}</p>}
    </div>
  );
}
