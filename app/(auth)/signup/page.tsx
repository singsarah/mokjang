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
    <div className="rounded-lg bg-white p-8 shadow">
      <h2 className="mb-6 text-xl font-semibold">가입하기</h2>

      <form action={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm">이름</span>
          <input
            name="displayName"
            required
            maxLength={50}
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm">이메일</span>
          <input
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm">비밀번호 (8자 이상, 영문+숫자)</span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input name="consent" type="checkbox" required className="mt-1" />
          <span>
            <Link href="/privacy" className="text-pasture-600 underline">
              개인정보 처리 방침
            </Link>
            에 동의합니다
          </span>
        </label>
        {error && <p className="text-sm text-coral-500">{error}</p>}
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-pasture-500 py-3 text-white hover:bg-pasture-600 disabled:opacity-50"
        >
          {isPending ? "가입 중..." : "가입하기"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="text-pasture-600 underline">
          로그인
        </Link>
      </p>
    </div>
  );
}
