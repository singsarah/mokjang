"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { promoteGrades } from "@/app/actions/students";

export function PromoteButton() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function onClick() {
    if (!confirm("모든 학생의 학년을 1씩 올립니다. 3학년은 졸업 처리되어 명단에서 빠집니다. 진행할까요?")) return;
    setError(undefined);
    startTransition(async () => {
      const result = await promoteGrades();
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-end">
      <button
        onClick={onClick}
        disabled={isPending}
        className="rounded-btn border border-sage px-3 py-1 text-xs text-sage-deep transition hover:bg-sage-soft disabled:opacity-50"
      >
        {isPending ? "진급 중..." : "학년 올리기"}
      </button>
      {error && <span className="mt-1 text-xs text-danger">{error}</span>}
    </span>
  );
}
