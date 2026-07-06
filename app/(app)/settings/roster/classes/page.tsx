import Link from "next/link";
import { redirect } from "next/navigation";
import { loadRoster } from "@/lib/students";
import { createClass, deleteClass } from "@/app/actions/classes";

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
            await createClass({ name: String(formData.get("name") ?? "") });
          }}
          className="mt-6 flex gap-2"
        >
          <input
            name="name"
            placeholder="반 이름"
            required
            className="flex-1 rounded-btn border border-border bg-white px-3 py-2 text-ink"
            aria-label="반 이름"
          />
          <button className="rounded-btn bg-sage px-4 py-2 font-medium text-white shadow-sm transition hover:bg-sage-deep">
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
              <li
                key={c.id}
                className="flex items-center justify-between rounded-card border border-border/60 bg-white p-3 shadow-sm"
              >
                <span className="text-ink">
                  {c.name}{" "}
                  <span className="text-xs text-ink-muted">({n}명)</span>
                </span>
                {n === 0 && (
                  <form
                    action={async () => {
                      "use server";
                      await deleteClass({ id: c.id });
                    }}
                  >
                    <button className="rounded-btn border border-danger px-3 py-1 text-xs text-danger transition hover:bg-unconfirmed-soft">
                      삭제
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
