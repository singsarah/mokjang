import Link from "next/link";
import { redirect } from "next/navigation";
import { loadRoster } from "@/lib/students";
import { StudentForm } from "@/components/student-form";

export default async function NewStudentPage() {
  const { canEdit, classes, groupId } = await loadRoster();
  if (!canEdit) redirect("/settings/roster");
  return (
    <main className="min-h-screen bg-card pb-24">
      <div className="mx-auto max-w-md px-6 py-8">
        <Link
          href="/settings/roster"
          className="text-sm text-ink-muted hover:text-ink"
        >
          ← 학적부
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-ink">
          학생 추가
        </h1>
        <div className="mt-6 rounded-card border border-border/60 bg-white p-5 shadow-sm">
          <StudentForm classes={classes} groupId={groupId} />
        </div>
      </div>
    </main>
  );
}
