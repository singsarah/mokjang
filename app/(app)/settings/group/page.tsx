import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership } from "@/lib/memberships";
import { JoinShare } from "@/components/join-share";

export default async function GroupSettingsPage() {
  const m = await requireCurrentMembership();
  if (m.role !== "master") redirect("/settings");

  const supabase = await createServerClient();
  const { data: group } = await supabase
    .from("groups")
    .select("name, join_code, created_at")
    .eq("id", m.groupId)
    .single();

  // 참여 링크는 현재 요청의 호스트로 생성 (로컬/배포 모두 대응).
  const h = await headers();
  const host = h.get("host") ?? "";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const joinUrl =
    host && group?.join_code
      ? `${proto}://${host}/invite/${group.join_code}`
      : "";

  return (
    <main className="min-h-screen bg-[#E6EAE0] pb-24">
      <div className="mx-auto max-w-md px-6 py-8">
        <Link
          href="/settings"
          className="text-sm text-ink-muted hover:text-ink"
        >
          ← 설정
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-ink">그룹 관리</h1>

        <section className="mt-6 rounded-card border border-border/60 bg-white p-6 shadow-sm">
          <div className="text-sm text-ink-muted">그룹 이름</div>
          <div className="mt-1 text-lg font-semibold text-ink">{group?.name}</div>
        </section>

        <section className="mt-4 rounded-card border border-border/60 bg-white p-6 shadow-sm">
          <JoinShare code={group?.join_code ?? ""} url={joinUrl} />
        </section>
      </div>
    </main>
  );
}
