"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { joinGroup } from "@/app/actions/groups";

function readCookieCode(): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(/(?:^|;\s*)pending_join_code=([^;]+)/);
  if (!m) return "";
  return decodeURIComponent(m[1])
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

export function JoinForm({ codeFromUrl }: { codeFromUrl: string }) {
  const [code, setCode] = useState(codeFromUrl);
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  // URL에 코드가 없으면 초대 링크가 남긴 쿠키에서 채운다 (로그인/가입 후 복귀 시).
  useEffect(() => {
    if (code) return;
    const fromCookie = readCookieCode();
    if (fromCookie) setCode(fromCookie);
  }, [code]);

  async function onSubmit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await joinGroup({ code: formData.get("code") as string });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="rounded-card border border-border/60 bg-white p-8 shadow-sm">
      <h2 className="mb-2 font-display text-xl font-bold text-ink">그룹 참여</h2>
      <p className="mb-6 text-sm text-ink-muted">
        마스터에게 받은 8자리 코드를 입력하세요.
      </p>
      <form action={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm text-ink">그룹 코드</span>
          <input
            name="code"
            required
            maxLength={8}
            value={code}
            onChange={(e) =>
              setCode(
                e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8),
              )
            }
            className="mt-1 w-full rounded-btn border border-border px-3 py-3 text-center text-lg uppercase tracking-widest text-ink"
            placeholder="ABCD2345"
          />
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-btn bg-sage py-3 font-medium text-white shadow-sm transition hover:bg-sage-deep disabled:opacity-50"
        >
          {isPending ? "참여 신청 중..." : "참여 신청"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-muted">
        아직 그룹이 없으신가요?{" "}
        <Link href="/new-group" className="text-sky-deep underline">
          새 그룹 만들기
        </Link>
      </p>
    </div>
  );
}
