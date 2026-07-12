import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCurrentMembership } from "@/lib/memberships";
import { EventImport } from "@/components/event-import";

export default async function ImportEventsPage() {
  const m = await requireCurrentMembership();
  if (m.role === "viewer") redirect("/calendar");

  return (
    <main className="min-h-screen bg-card pb-36">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <Link href="/calendar" className="text-sm text-ink-muted hover:text-ink">
          ← 일정
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-ink">일정표 가져오기</h1>

        <ol className="mt-4 space-y-1 text-sm text-ink-muted">
          <li>1. 템플릿 엑셀은 바로 등록(키 불필요), 사진·PDF·자유 양식 엑셀은 AI가 읽어옵니다.</li>
          <li>2. 일정표 파일을 선택하면 내용이 표로 나와요. 확인·수정하세요.</li>
          <li>3. 등록 버튼을 누르면 달력에 한꺼번에 추가됩니다.</li>
        </ol>

        <div className="mt-6">
          <EventImport />
        </div>
      </div>
    </main>
  );
}
