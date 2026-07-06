import { redirect } from "next/navigation";
import { loadRoster } from "@/lib/students";
import { StudentForm } from "@/components/student-form";

export default async function NewStudentPage() {
  const { canEdit, classes } = await loadRoster();
  if (!canEdit) redirect("/settings/roster");
  return (
    <main className="mx-auto max-w-2xl px-6 py-6">
      <h1 className="text-2xl font-bold">학생 추가</h1>
      <div className="mt-6">
        <StudentForm classes={classes} />
      </div>
    </main>
  );
}
