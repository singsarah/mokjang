import { redirect } from "next/navigation";
import { loadRoster } from "@/lib/students";
import { createClass, deleteClass } from "@/app/actions/classes";

export default async function ClassesPage() {
  const { canEdit, classes, students } = await loadRoster();
  if (!canEdit) redirect("/settings/roster");

  const countByClass = new Map<string, number>();
  for (const s of students) {
    if (s.classId) countByClass.set(s.classId, (countByClass.get(s.classId) ?? 0) + 1);
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-6">
      <h1 className="text-2xl font-bold">반 관리</h1>

      <form
        action={async (formData: FormData) => {
          "use server";
          await createClass({ grade: Number(formData.get("grade") ?? 1), name: String(formData.get("name") ?? "") });
        }}
        className="mt-6 flex gap-2"
      >
        <input name="grade" type="number" min={1} max={6} defaultValue={1} required className="w-20 rounded-md border px-3 py-2" aria-label="학년" />
        <input name="name" placeholder="반 이름 (예: 믿음반)" required className="flex-1 rounded-md border px-3 py-2" aria-label="반 이름" />
        <button className="rounded-md bg-pasture-500 px-4 py-2 text-white">추가</button>
      </form>

      <ul className="mt-8 space-y-2">
        {classes.length === 0 && (
          <p className="text-center text-gray-500">아직 반이 없어요. (반 없이도 사용 가능)</p>
        )}
        {classes.map((c) => {
          const n = countByClass.get(c.id) ?? 0;
          return (
            <li key={c.id} className="flex items-center justify-between rounded-lg border bg-white p-3 shadow-sm">
              <span>{c.grade}학년 {c.name} <span className="text-xs text-gray-500">({n}명)</span></span>
              {n === 0 && (
                <form action={async () => { "use server"; await deleteClass({ id: c.id }); }}>
                  <button className="rounded-md border border-coral-500 px-3 py-1 text-xs text-coral-500">삭제</button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
