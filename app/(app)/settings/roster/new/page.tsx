import Link from "next/link";
import { redirect } from "next/navigation";
import { loadRoster } from "@/lib/students";
import { StudentForm } from "@/components/student-form";

export default async function NewStudentPage() {
  const { canEdit, classes, groupId } = await loadRoster();
  if (!canEdit) redirect("/settings/roster");
  return (
    <main className="mx-auto max-w-2xl px-6 py-6">
      <Link
        href="/settings/roster"
        className="text-sm text-pasture-600 hover:underline"
      >
        ← 학적부
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold">학생 추가</h1>
      <div className="mt-6">
        <StudentForm classes={classes} groupId={groupId} />
      </div>
    </main>
  );
}
