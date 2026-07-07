import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { loadRoster } from "@/lib/students";
import { ClassDetail } from "@/components/class-detail";

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const { canEdit, classes, students } = await loadRoster();
  if (!canEdit) redirect("/settings/roster");

  const cls = classes.find((c) => c.id === classId);
  if (!cls) notFound();

  const classNameById = new Map(classes.map((c) => [c.id, c.name]));
  const members = students
    .filter((s) => s.classId === classId)
    .map((s) => ({ id: s.id, name: s.name }));
  const candidates = students
    .filter((s) => s.classId !== classId)
    .map((s) => ({
      id: s.id,
      name: s.name,
      currentClassName: s.classId ? classNameById.get(s.classId) ?? null : null,
    }))
    // 미배정을 위로, 그다음 이름순
    .sort((a, b) => {
      if (!a.currentClassName && b.currentClassName) return -1;
      if (a.currentClassName && !b.currentClassName) return 1;
      return a.name.localeCompare(b.name, "ko");
    });

  return (
    <main className="min-h-screen bg-card pb-24">
      <div className="mx-auto max-w-md px-6 py-8">
        <Link href="/settings/roster/classes" className="text-sm text-ink-muted hover:text-ink">
          ← 반 관리
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-ink">{cls.name}</h1>
        <div className="mt-6">
          <ClassDetail
            classId={cls.id}
            className={cls.name}
            teacherName={cls.teacherName}
            members={members}
            candidates={candidates}
            canDelete={members.length === 0}
          />
        </div>
      </div>
    </main>
  );
}
