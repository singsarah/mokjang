import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership } from "@/lib/memberships";
import { MinuteDeleteButton } from "@/components/minute-delete-button";

// 회의록 상세(읽기) — 전체 내용 표시. 편집 권한이면 수정/삭제 가능.
export default async function MinuteDetailPage({
  params,
}: {
  params: Promise<{ minuteId: string }>;
}) {
  const { minuteId } = await params;
  const m = await requireCurrentMembership();
  const canEdit = m.role === "master" || m.role === "editor";
  const supabase = await createServerClient();

  const { data: minute } = await supabase
    .from("meeting_minutes")
    .select("id, title, meeting_date, content")
    .eq("id", minuteId)
    .eq("group_id", m.groupId)
    .maybeSingle();
  if (!minute) redirect("/minutes");

  const [y, mo, d] = minute.meeting_date.split("-");
  const dateLabel = `${y}년 ${Number(mo)}월 ${Number(d)}일`;

  return (
    <main className="min-h-screen bg-blush-soft pb-36">
      <div className="mx-auto max-w-md px-6 py-8">
        <Link href="/minutes" className="text-sm text-ink-muted hover:text-ink">
          ← 회의록
        </Link>

        <div className="mt-2 text-sm text-ink-muted">{dateLabel}</div>
        <h1 className="mt-1 font-display text-2xl font-bold text-ink">{minute.title}</h1>

        {canEdit && (
          <div className="mt-4 flex gap-2">
            <Link
              href={`/minutes/${minute.id}/edit`}
              className="rounded-btn border border-border bg-white px-4 py-1.5 text-sm text-ink transition hover:bg-card"
            >
              수정
            </Link>
            <MinuteDeleteButton minuteId={minute.id} />
          </div>
        )}

        <div className="mt-6 rounded-card border border-border/60 bg-white p-5 shadow-sm">
          {minute.content.trim() === "" ? (
            <p className="text-sm text-ink-muted">내용이 없어요.</p>
          ) : (
            <p className="whitespace-pre-wrap break-words text-ink">{minute.content}</p>
          )}
        </div>
      </div>
    </main>
  );
}
