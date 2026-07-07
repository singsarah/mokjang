import Link from "next/link";
import { redirect } from "next/navigation";
import { loadRoster } from "@/lib/students";
import { createClass } from "@/app/actions/classes";

export default async function ClassesPage() {
  const { canEdit, classes, students } = await loadRoster();
  if (!canEdit) redirect("/settings/roster");

  const countByClass = new Map<string, number>();
  for (const s of students) {
    if (s.classId)
      countByClass.set(s.classId, (countByClass.get(s.classId) ?? 0) + 1);
  }

  return (
    <main className="min-h-screen bg-card pb-24">
      <div className="mx-auto max-w-md px-6 py-8">
        <Link
          href="/settings/roster"
          className="text-sm text-ink-muted hover:text-ink"
        >
          ← 학적부
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
          <div className="flex gap-2">
            <input
              name="name"
              placeholder="반 이름"
              required
              className="flex-1 rounded-btn border border-border bg-white px-3 py-2 text-ink"
              aria-label="반 이름"
            />
            <input
              name="teacherName"
              placeholder="선생님 이름 (선택)"
              className="flex-1 rounded-btn border border-border bg-white px-3 py-2 text-ink"
              aria-label="선생님 이름"
            />
          </div>
          <button className="w-full rounded-btn bg-sage px-4 py-2 font-medium text-white shadow-sm transition hover:bg-sage-deep">
            추가
          </button>
        </form>

        <ul className="mt-8 space-y-2">
          {classes.length === 0 && (
            <p className="text-center text-ink-muted">
              아직 반이 없어요. (반 없이도 사용 가능)
            </p>
          )}
          {classes.map((c) => {
            const n = countByClass.get(c.id) ?? 0;
            return (
              <li key={c.id}>
                <Link
                  href={`/settings/roster/classes/${c.id}`}
                  className="flex items-center justify-between rounded-card border border-border/60 bg-white p-3 shadow-sm transition hover:shadow-md"
                >
                  <span className="text-ink">
                    {c.name}
                    {c.teacherName && (
                      <span className="text-sm text-ink-muted"> · {c.teacherName} 선생님</span>
                    )}{" "}
                    <span className="text-xs text-ink-muted">({n}명)</span>
                  </span>
                  <span className="text-lg text-ink-muted">›</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
