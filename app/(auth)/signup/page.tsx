"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { signUpEmailPassword } from "@/app/actions/auth";

export default function SignupPage() {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  async function onSubmit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await signUpEmailPassword({
        displayName: formData.get("displayName") as string,
        email: formData.get("email") as string,
        password: formData.get("password") as string,
        consent: formData.get("consent") === "on" ? true : (false as never),
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="rounded-card border border-border/60 bg-white p-8 shadow-sm">
      <h2 className="mb-6 font-display text-xl font-bold text-ink">가입하기</h2>

      <form action={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm text-ink">이름</span>
          <input
            name="displayName"
            required
            maxLength={50}
            className="mt-1 w-full rounded-btn border border-border px-3 py-2 text-ink"
          />
        </label>
        <label className="block">
          <span className="text-sm text-ink">이메일</span>
          <input
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded-btn border border-border px-3 py-2 text-ink"
          />
        </label>
        <label className="block">
          <span className="text-sm text-ink">비밀번호 (8자 이상, 영문+숫자)</span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            className="mt-1 w-full rounded-btn border border-border px-3 py-2 text-ink"
          />
        </label>
        <label className="flex items-start gap-2 text-sm text-ink">
          <input name="consent" type="checkbox" required className="mt-1" />
          <span>
            <Link href="/privacy" className="text-sky-deep underline">
              개인정보 처리 방침
            </Link>
            에 동의합니다
          </span>
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-btn bg-sage py-3 font-medium text-white shadow-sm transition hover:bg-sage-deep disabled:opacity-50"
        >
          {isPending ? "가입 중..." : "가입하기"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="text-sky-deep underline">
          로그인
        </Link>
      </p>
    </div>
  );
}
