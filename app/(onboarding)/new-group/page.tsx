"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createGroup } from "@/app/actions/groups";

export default function NewGroupPage() {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  async function onSubmit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await createGroup({ name: formData.get("name") as string });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="rounded-card border border-border/60 bg-white p-8 shadow-sm">
      <h2 className="mb-2 font-display text-xl font-bold text-ink">새 그룹 만들기</h2>
      <p className="mb-6 text-sm text-ink-muted">
        그룹을 만들면 자동으로 마스터가 되고, 8자리 코드가 발급됩니다.
      </p>
      <form action={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm text-ink">그룹 이름 (예: 고등부)</span>
          <input
            name="name"
            required
            maxLength={100}
            className="mt-1 w-full rounded-btn border border-border px-3 py-2 text-ink"
          />
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-btn bg-sage py-3 font-medium text-white shadow-sm transition hover:bg-sage-deep disabled:opacity-50"
        >
          {isPending ? "생성 중..." : "그룹 만들기"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-muted">
        이미 그룹 코드를 받으셨다면{" "}
        <Link href="/join" className="text-sky-deep underline">
          그룹 참여
        </Link>
      </p>
    </div>
  );
}
