import { redirect } from "next/navigation";
import { loadRoster } from "@/lib/students";
import { restoreStudent } from "@/app/actions/students";

export default async function HiddenStudentsPage() {
  const { canEdit, students } = await loadRoster({ includeDeleted: true });
  if (!canEdit) redirect("/settings/roster");

  return (
    <main className="mx-auto max-w-2xl px-6 py-6">
      <h1 className="text-2xl font-bold">숨김 학생</h1>
      <p className="mt-1 text-sm text-gray-500">삭제된 학생입니다. 복원할 수 있어요.</p>
      {students.length === 0 ? (
        <p className="mt-10 text-center text-gray-500">숨긴 학생이 없어요.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {students.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded-lg border bg-white p-3 shadow-sm">
              <span>{s.name} <span className="text-xs text-gray-500">{s.grade}학년</span></span>
              <form action={async () => { "use server"; await restoreStudent({ id: s.id }); }}>
                <button className="rounded-md border border-pasture-500 px-3 py-1 text-sm text-pasture-600">복원</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
