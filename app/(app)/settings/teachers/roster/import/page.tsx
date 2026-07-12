import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCurrentMembership } from "@/lib/memberships";
import { TeacherImport } from "@/components/teacher-import";

export default async function ImportTeachersPage() {
  const m = await requireCurrentMembership();
  if (m.role !== "master") redirect("/settings/teachers");

  return (
    <main className="min-h-screen bg-card pb-36">
      <div className="mx-auto max-w-md px-6 py-8">
        <Link href="/settings/teachers" className="text-sm text-ink-muted hover:text-ink">
          ← 교사 관리
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-ink">교사 엑셀 업로드</h1>

        <ol className="mt-4 space-y-1 text-sm text-ink-muted">
          <li>1. &lsquo;양식 다운로드&rsquo;로 엑셀 양식을 받으세요.</li>
          <li>2. 양식의 예시 행을 지우고 교사 정보를 채우세요.</li>
          <li>3. 채운 파일을 선택해 미리보기를 확인하고 등록하세요.</li>
        </ol>

        <div className="mt-6">
          <TeacherImport />
        </div>
      </div>
    </main>
  );
}
