"use client";

import { useState, useTransition } from "react";
import { deleteAccount } from "@/app/actions/account";

// 계정 삭제 실행 버튼 — 체크박스로 내용 확인 후, 확인창을 한 번 더 거친다.
export function DeleteAccountButton() {
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function onClick() {
    if (
      !window.confirm(
        "정말 계정을 삭제할까요?\n삭제하면 되돌릴 수 없어요.",
      )
    )
      return;
    setError(undefined);
    startTransition(async () => {
      const result = await deleteAccount();
      // 성공 시 서버에서 홈으로 리다이렉트되므로 여기 도달하면 실패한 경우.
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="mt-6 space-y-4">
      <label className="flex items-start gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-danger"
        />
        위 내용을 확인했으며, 계정 삭제는 되돌릴 수 없다는 것을 이해합니다.
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        onClick={onClick}
        disabled={!checked || isPending}
        className="w-full rounded-btn bg-danger py-3 font-medium text-white shadow-sm transition hover:opacity-90 disabled:opacity-40"
      >
        {isPending ? "삭제 중…" : "계정 삭제"}
      </button>
    </div>
  );
}
