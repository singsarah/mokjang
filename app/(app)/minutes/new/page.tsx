import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCurrentMembership } from "@/lib/memberships";
import { MinuteForm } from "@/components/minute-form";

export default async function NewMinutePage() {
  const m = await requireCurrentMembership();
  if (m.role !== "master" && m.role !== "editor") redirect("/minutes");

  // 기본 날짜 = KST 오늘 (Vercel 서버는 UTC — 타임존 명시)
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());

  return (
    <main className="min-h-screen bg-blush-soft pb-36">
      <div className="mx-auto max-w-md px-6 py-8">
        <Link href="/minutes" className="text-sm text-ink-muted hover:text-ink">
          ← 회의록
        </Link>
        <h1 className="mb-6 mt-2 font-display text-2xl font-bold text-ink">회의록 작성</h1>
        <MinuteForm defaultDate={today} />
      </div>
    </main>
  );
}
