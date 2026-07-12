import Link from "next/link";
import { redirect } from "next/navigation";
import { loadRoster } from "@/lib/students";
import { createClass } from "@/app/actions/classes";
import { UnassignAllButton } from "@/components/unassign-all-button";
import { ClassList } from "@/components/class-list";

export default async function ClassesPage() {
  const { canEdit, classes, students } = await loadRoster();
  if (!canEdit) redirect("/settings/roster");

  const countByClass = new Map<string, number>();
  for (const s of students) {
    if (s.classId)
      countByClass.set(s.classId, (countByClass.get(s.classId) ?? 0) + 1);
  }

  return (
    <main className="min-h-screen bg-card pb-36">
      <div className="mx-auto max-w-md px-6 py-8">
        <Link
          href="/settings"
          className="text-sm text-ink-muted hover:text-ink"
        >
          ← 설정
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-ink">반 관리</h1>
        <p className="mt-1 text-sm text-ink-muted">
          반 이름을 자유롭게 추가하세요. (예: 믿음반, 1-3학년 통합반)
        </p>

        <form
          action={async (formData: FormData) => {
            "use server";
            await createClass({
              name: String(formData.get("name") ?? ""),
              teacherName: (formData.get("teacherName") as string) || null,
            });
          }}
          className="mt-6 space-y-2"
        >
          {/* 좁은 폰에서 가로 배치가 화면 밖으로 밀려 두 줄로 쌓는다 */}
          <input
            name="name"
            placeholder="반 이름"
            required
            className="w-full rounded-btn border border-border bg-white px-3 py-2 text-ink"
            aria-label="반 이름"
          />
          <input
            name="teacherName"
            placeholder="선생님 이름 (선택)"
            className="w-full rounded-btn border border-border bg-white px-3 py-2 text-ink"
            aria-label="선생님 이름"
          />
          <button className="w-full rounded-btn bg-sage px-4 py-2 font-medium text-white shadow-sm transition hover:bg-sage-deep">
            추가
          </button>
        </form>

        <ClassList
          classes={classes.map((c) => ({
            id: c.id,
            name: c.name,
            teacherName: c.teacherName,
            count: countByClass.get(c.id) ?? 0,
          }))}
        />

        {students.some((s) => s.classId) && <UnassignAllButton />}
      </div>
    </main>
  );
}
