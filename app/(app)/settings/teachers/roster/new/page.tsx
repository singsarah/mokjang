import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCurrentMembership } from "@/lib/memberships";
import { TeacherForm } from "@/components/teacher-form";

export default async function NewTeacherPage() {
  const m = await requireCurrentMembership();
  if (m.role !== "master") redirect("/settings/teachers");
  return (
    <main className="min-h-screen bg-card pb-36">
      <div className="mx-auto max-w-md px-6 py-8">
        <Link href="/settings/teachers" className="text-sm text-ink-muted hover:text-ink">
          ← 교사 관리
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-ink">교사 추가</h1>
        <div className="mt-6 rounded-card border border-border/60 bg-white p-5 shadow-sm">
          <TeacherForm />
        </div>
      </div>
    </main>
  );
}
