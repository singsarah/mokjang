import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCurrentMembership } from "@/lib/memberships";
import { loadTeacher } from "@/lib/teachers";
import { TeacherForm } from "@/components/teacher-form";
import { deleteTeacher } from "@/app/actions/teachers";

export default async function EditTeacherPage({
  params,
}: {
  params: Promise<{ teacherId: string }>;
}) {
  const { teacherId } = await params;
  const m = await requireCurrentMembership();
  if (m.role !== "master") redirect("/settings/teachers");

  const t = await loadTeacher(teacherId);
  if (!t) redirect("/settings/teachers");

  return (
    <main className="min-h-screen bg-card pb-24">
      <div className="mx-auto max-w-md px-6 py-8">
        <Link href="/settings/teachers" className="text-sm text-ink-muted hover:text-ink">
          ← 교사 관리
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-ink">교사 수정</h1>
        <div className="mt-6 rounded-card border border-border/60 bg-white p-5 shadow-sm">
          <TeacherForm
            teacherId={t.id}
            initial={{
              name: t.name,
              birthdayMonth: t.birthdayMonth,
              birthdayDay: t.birthdayDay,
              birthdayYear: t.birthdayYear,
              phone: t.phone,
              kakaoId: t.kakaoId,
              duty: t.duty,
              jobType: t.jobType,
              note: t.note,
            }}
          />
        </div>

        <form
          action={async () => {
            "use server";
            await deleteTeacher({ id: teacherId });
            redirect("/settings/teachers");
          }}
          className="mt-8"
        >
          <button className="w-full rounded-btn border border-danger py-3 text-danger transition hover:bg-unconfirmed-soft">
            교사 삭제
          </button>
        </form>
      </div>
    </main>
  );
}
