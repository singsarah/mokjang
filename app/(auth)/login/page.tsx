"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, useTransition } from "react";
import { signInEmailPassword, signInWithGoogle } from "@/app/actions/auth";

function LoginForm() {
  const searchParams = useSearchParams();
  const oauthFailed = searchParams.get("error") === "oauth";
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  // The form's own error takes priority; otherwise surface an OAuth failure
  // redirected here by signInWithGoogle / the /auth/callback route.
  const displayError =
    error ??
    (oauthFailed ? "구글 로그인에 실패했습니다. 다시 시도해주세요." : undefined);

  async function onSubmit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await signInEmailPassword({
        email: formData.get("email") as string,
        password: formData.get("password") as string,
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="rounded-card border border-border/60 bg-white p-8 shadow-sm">
      <h2 className="mb-6 font-display text-xl font-bold text-ink">로그인</h2>

      <form action={signInWithGoogle}>
        <button
          type="submit"
          className="mb-6 flex w-full items-center justify-center gap-2 rounded-btn border border-border py-3 text-ink transition hover:bg-card"
        >
          <span>🇬</span> 구글로 시작하기
        </button>
      </form>

      <div className="mb-4 flex items-center gap-3 text-sm text-ink-muted">
        <div className="h-px flex-1 bg-border" />
        <span>또는</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form action={onSubmit} className="space-y-4">
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
          <span className="text-sm text-ink">비밀번호</span>
          <input
            name="password"
            type="password"
            required
            className="mt-1 w-full rounded-btn border border-border px-3 py-2 text-ink"
          />
        </label>
        {displayError && <p className="text-sm text-danger">{displayError}</p>}
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-btn bg-sage py-3 font-medium text-white shadow-sm transition hover:bg-sage-deep disabled:opacity-50"
        >
          {isPending ? "로그인 중..." : "로그인"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        계정이 없으신가요?{" "}
        <Link href="/signup" className="text-sky-deep underline">
          가입하기
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams() requires a Suspense boundary in the App Router.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
