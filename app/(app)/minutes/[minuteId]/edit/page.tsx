import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership } from "@/lib/memberships";
import { MinuteForm } from "@/components/minute-form";

export default async function EditMinutePage({
  params,
}: {
  params: Promise<{ minuteId: string }>;
}) {
  const { minuteId } = await params;
  const m = await requireCurrentMembership();
  if (m.role !== "master" && m.role !== "editor") redirect("/minutes");
  const supabase = await createServerClient();

  const { data: minute } = await supabase
    .from("meeting_minutes")
    .select("id, title, meeting_date, content")
    .eq("id", minuteId)
    .eq("group_id", m.groupId)
    .maybeSingle();
  if (!minute) redirect("/minutes");

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());

  return (
    <main className="min-h-screen bg-blush-soft pb-24">
      <div className="mx-auto max-w-md px-6 py-8">
        <Link
          href={`/minutes/${minute.id}`}
          className="text-sm text-ink-muted hover:text-ink"
        >
          ← 회의록 보기
        </Link>
        <h1 className="mb-6 mt-2 font-display text-2xl font-bold text-ink">회의록 수정</h1>
        <MinuteForm
          minuteId={minute.id}
          defaultDate={today}
          initial={{
            title: minute.title,
            date: minute.meeting_date,
            content: minute.content,
          }}
        />
      </div>
    </main>
  );
}
