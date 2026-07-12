import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership } from "@/lib/memberships";

// 회의록 목록 — 최신 회의 날짜순 누적. 카드 클릭 → 전체 내용 보기.
export default async function MinutesPage() {
  const m = await requireCurrentMembership();
  const canEdit = m.role === "master" || m.role === "editor";
  const supabase = await createServerClient();

  const { data: rows } = await supabase
    .from("meeting_minutes")
    .select("id, title, meeting_date, content")
    .eq("group_id", m.groupId)
    .order("meeting_date", { ascending: false })
    .order("created_at", { ascending: false });
  const minutes = rows ?? [];

  function formatDate(iso: string): string {
    const [y, mo, d] = iso.split("-");
    return `${y}년 ${Number(mo)}월 ${Number(d)}일`;
  }
  // 미리보기: 본문에서 내용 있는 첫 줄만.
  function preview(content: string): string {
    return content.split("\n").find((line) => line.trim() !== "")?.trim() ?? "";
  }

  return (
    <main className="min-h-screen bg-card pb-24">
      <div className="mx-auto max-w-md px-6 py-8">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-ink">회의록</h1>
          {canEdit && (
            <Link
              href="/minutes/new"
              className="rounded-btn bg-sage px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sage-deep"
            >
              + 회의록 작성
            </Link>
          )}
        </div>

        {minutes.length === 0 ? (
          <p className="mt-12 text-center text-ink-muted">
            아직 회의록이 없어요.
            {canEdit && (
              <>
                <br />위 버튼으로 첫 회의록을 작성해보세요.
              </>
            )}
          </p>
        ) : (
          <ul className="mt-6 space-y-2">
            {minutes.map((mi) => (
              <li key={mi.id}>
                <Link
                  href={`/minutes/${mi.id}`}
                  className="block rounded-card border border-border/60 bg-white p-4 shadow-sm transition hover:shadow-md"
                >
                  <div className="text-sm text-ink-muted">{formatDate(mi.meeting_date)}</div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-medium text-ink">{mi.title}</span>
                    <span className="shrink-0 text-lg text-ink-muted">›</span>
                  </div>
                  {preview(mi.content) && (
                    <div className="mt-0.5 truncate text-sm text-ink-muted">
                      {preview(mi.content)}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
