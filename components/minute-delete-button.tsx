"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteMinute } from "@/app/actions/minutes";

// 회의록 삭제 — 영구 삭제라 확인창을 거친다.
export function MinuteDeleteButton({ minuteId }: { minuteId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function onClick() {
    if (!window.confirm("이 회의록을 삭제할까요?\n삭제하면 되돌릴 수 없어요.")) return;
    setError(undefined);
    startTransition(async () => {
      const result = await deleteMinute({ id: minuteId });
      if (result?.error) {
        setError("삭제에 실패했어요. 다시 시도해주세요.");
        return;
      }
      router.push("/minutes");
      router.refresh();
    });
  }

  return (
    <>
      <button
        onClick={onClick}
        disabled={isPending}
        className="rounded-btn border border-danger px-4 py-1.5 text-sm text-danger transition hover:bg-unconfirmed-soft disabled:opacity-50"
      >
        {isPending ? "삭제 중…" : "삭제"}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </>
  );
}
