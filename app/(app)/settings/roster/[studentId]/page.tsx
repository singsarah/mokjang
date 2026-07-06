import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership } from "@/lib/memberships";
import { loadRoster } from "@/lib/students";
import { StudentForm } from "@/components/student-form";
import { softDeleteStudent } from "@/app/actions/students";

export default async function EditStudentPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const m = await requireCurrentMembership();
  if (m.role !== "master" && m.role !== "editor") redirect("/settings/roster");

  const supabase = await createServerClient();
  const { data: s } = await supabase
    .from("students")
    .select("id, name, grade, class_id, birthday_month, birthday_day, birthday_year, phone_self, phone_guardian, guardian_relation")
    .eq("id", studentId)
    .eq("group_id", m.groupId)
    .maybeSingle();
  if (!s) redirect("/settings/roster");

  const { classes } = await loadRoster();

  return (
    <main className="mx-auto max-w-2xl px-6 py-6">
      <h1 className="text-2xl font-bold">학생 수정</h1>
      <div className="mt-6">
        <StudentForm
          classes={classes}
          studentId={s.id}
          initial={{
            name: s.name,
            grade: s.grade,
            classId: s.class_id,
            birthdayMonth: s.birthday_month,
            birthdayDay: s.birthday_day,
            birthdayYear: s.birthday_year,
            phoneSelf: s.phone_self,
            phoneGuardian: s.phone_guardian,
            guardianRelation: s.guardian_relation,
          }}
        />
      </div>

      <form
        action={async () => {
          "use server";
          await softDeleteStudent({ id: studentId });
          redirect("/settings/roster");
        }}
        className="mt-8"
      >
        <button className="w-full rounded-lg border border-coral-500 py-3 text-coral-500">
          학생 삭제 (숨김 처리)
        </button>
      </form>
    </main>
  );
}
