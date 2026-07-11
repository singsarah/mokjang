import Link from "next/link";
import { redirect } from "next/navigation";
import { loadRoster } from "@/lib/students";
import { StudentForm } from "@/components/student-form";

// ?classId= 로 진입하면(반 상세의 "새 학생 만들기") 그 반이 미리 선택되고
// 저장 후 학적부 대신 해당 반 상세로 돌아간다.
export default async function NewStudentPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>;
}) {
  const { canEdit, classes, groupId } = await loadRoster();
  if (!canEdit) redirect("/settings/roster");

  const { classId } = await searchParams;
  const fromClass = classId ? classes.find((c) => c.id === classId) : undefined;
  const backHref = fromClass
    ? `/settings/roster/classes/${fromClass.id}`
    : "/settings/roster";

  return (
    <main className="min-h-screen bg-card pb-24">
      <div className="mx-auto max-w-md px-6 py-8">
        <Link href={backHref} className="text-sm text-ink-muted hover:text-ink">
          {fromClass ? `← ${fromClass.name}` : "← 학적부"}
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-ink">
          학생 추가
        </h1>
        <div className="mt-6 rounded-card border border-border/60 bg-white p-5 shadow-sm">
          <StudentForm
            classes={classes}
            groupId={groupId}
            defaultClassId={fromClass?.id}
            returnTo={fromClass ? backHref : undefined}
          />
        </div>
      </div>
    </main>
  );
}
