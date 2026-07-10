"use client";

import { useState, useTransition } from "react";
import { startDemo } from "@/app/actions/demo";

// "가입 없이 체험해 보기" — 랜딩·로그인 페이지 공용.
// 성공하면 startDemo 가 체험 그룹으로 redirect 한다.
export function DemoStartButton({ className }: { className?: string }) {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function onClick() {
    setError(undefined);
    startTransition(async () => {
      const result = await startDemo();
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className="w-full rounded-btn border border-sage bg-sage-soft px-8 py-3 font-medium text-sage-deep transition hover:bg-sage hover:text-white disabled:opacity-60"
      >
        {isPending ? "체험 공간 준비 중… (몇 초 걸려요)" : "🐑 가입 없이 체험해 보기"}
      </button>
      <p className="mt-2 text-center text-sm text-ink-muted">
        Dummy 멤버를 통해 전체 기능을
        <br />
        둘러볼 수 있어요
      </p>
      {error && <p className="mt-1 text-center text-sm text-danger">{error}</p>}
    </div>
  );
}
