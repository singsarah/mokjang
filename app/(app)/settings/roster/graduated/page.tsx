import Link from "next/link";
import { loadGraduates } from "@/lib/students";
import { restoreGraduate } from "@/app/actions/students";

export default async function GraduatedPage() {
  const { canEdit, students } = await loadGraduates();

  return (
    <main className="min-h-screen bg-card pb-36">
      <div className="mx-auto max-w-md px-6 py-8">
        <Link href="/settings/roster" className="text-sm text-ink-muted hover:text-ink">
          ← 학적부
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-ink">졸업생</h1>
        <p className="mt-1 text-sm text-ink-muted">진급 때 3학년이 졸업 처리된 학생입니다. 복원하면 3학년으로 학적부에 돌아갑니다.</p>

        {students.length === 0 ? (
          <p className="mt-12 text-center text-ink-muted">아직 졸업생이 없어요 🎓</p>
        ) : (
          <ul className="mt-6 space-y-2">
            {students.map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded-card border border-border/60 bg-white p-3 shadow-sm">
                <span className="text-ink">🎓 {s.name}</span>
                {canEdit && (
                  <form action={async () => { "use server"; await restoreGraduate({ id: s.id }); }}>
                    <button className="rounded-btn border border-border px-3 py-1 text-sm text-ink-muted transition hover:text-ink">
                      복원
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
