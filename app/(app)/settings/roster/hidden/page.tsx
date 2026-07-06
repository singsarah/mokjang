import Link from "next/link";
import { redirect } from "next/navigation";
import { loadRoster } from "@/lib/students";
import { restoreStudent } from "@/app/actions/students";

export default async function HiddenStudentsPage() {
  const { canEdit, students } = await loadRoster({ includeDeleted: true });
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
        <h1 className="mt-2 font-display text-2xl font-bold text-ink">숨김 학생</h1>
        <p className="mt-1 text-sm text-ink-muted">
          삭제된 학생입니다. 복원할 수 있어요.
        </p>
        {students.length === 0 ? (
          <p className="mt-10 text-center text-ink-muted">숨긴 학생이 없어요.</p>
        ) : (
          <ul className="mt-6 space-y-2">
            {students.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-card border border-border/60 bg-white p-3 shadow-sm"
              >
                <span className="text-ink">
                  {s.name}
                  {s.grade != null && (
                    <span className="text-xs text-ink-muted"> {s.grade}학년</span>
                  )}
                </span>
                <form action={async () => { "use server"; await restoreStudent({ id: s.id }); }}>
                  <button className="rounded-btn border border-sage px-3 py-1 text-sm text-sage-deep transition hover:bg-sage-soft">
                    복원
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
