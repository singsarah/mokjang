import Link from "next/link";
import { loadRoster } from "@/lib/students";

export default async function RosterPage() {
  const { canEdit, classes, students } = await loadRoster();
  const classMap = new Map(classes.map((c) => [c.id, c]));

  const groups = new Map<string, { label: string; sort: number; items: typeof students }>();
  for (const s of students) {
    const cls = s.classId ? classMap.get(s.classId) : null;
    const key = cls ? `c:${cls.id}` : `g:${s.grade}`;
    const label = cls ? `${cls.grade}학년 ${cls.name}` : `${s.grade}학년 (반 없음)`;
    const sort = cls ? cls.grade * 1000 + cls.displayOrder : s.grade * 1000 + 999;
    if (!groups.has(key)) groups.set(key, { label, sort, items: [] });
    groups.get(key)!.items.push(s);
  }
  const sections = [...groups.values()].sort((a, b) => a.sort - b.sort);

  return (
    <main className="mx-auto max-w-2xl px-6 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">학적부</h1>
        {canEdit && (
          <Link href="/settings/roster/new" className="rounded-md bg-pasture-500 px-4 py-2 text-sm text-white">
            + 학생 추가
          </Link>
        )}
      </div>

      <div className="mt-3 flex gap-3 text-sm">
        {canEdit && (
          <Link href="/settings/roster/classes" className="text-pasture-600 underline">반 관리</Link>
        )}
        <Link href="/settings/roster/hidden" className="text-gray-500 underline">숨김 학생</Link>
      </div>

      {sections.length === 0 ? (
        <p className="mt-10 text-center text-gray-500">아직 등록된 학생이 없어요 🐑</p>
      ) : (
        sections.map((sec) => (
          <section key={sec.label} className="mt-8">
            <h2 className="text-lg font-semibold">{sec.label} ({sec.items.length})</h2>
            <ul className="mt-3 space-y-2">
              {sec.items.map((s) => (
                <li key={s.id}>
                  <Link href={`/settings/roster/${s.id}`} className="block rounded-lg border bg-white p-3 shadow-sm hover:bg-pasture-50">
                    <span className="font-medium">{s.name}</span>
                    {s.phoneSelf && <span className="ml-2 text-xs text-gray-500">{s.phoneSelf}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
