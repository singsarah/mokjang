"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { joinGroup } from "@/app/actions/groups";

export default function JoinPage() {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  async function onSubmit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await joinGroup({ code: formData.get("code") as string });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="rounded-lg bg-white p-8 shadow">
      <h2 className="mb-2 text-xl font-semibold">그룹 참여</h2>
      <p className="mb-6 text-sm text-gray-600">
        마스터에게 받은 8자리 코드를 입력하세요.
      </p>
      <form action={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm">그룹 코드</span>
          <input
            name="code"
            required
            maxLength={8}
            style={{ textTransform: "uppercase" }}
            className="mt-1 w-full rounded-md border px-3 py-3 text-center text-lg tracking-widest uppercase"
            placeholder="ABCD2345"
          />
        </label>
        {error && <p className="text-sm text-coral-500">{error}</p>}
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-pasture-500 py-3 text-white hover:bg-pasture-600 disabled:opacity-50"
        >
          {isPending ? "참여 신청 중..." : "참여 신청"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-600">
        아직 그룹이 없으신가요?{" "}
        <Link href="/new-group" className="text-pasture-600 underline">
          새 그룹 만들기
        </Link>
      </p>
    </div>
  );
}
