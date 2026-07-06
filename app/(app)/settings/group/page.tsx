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
    <main className="mx-auto max-w-md px-6 py-6">
      <h1 className="font-display text-2xl font-bold">그룹 관리</h1>

      <section className="mt-8 rounded-lg bg-white p-6 shadow-sm">
        <div className="text-sm text-gray-500">그룹 이름</div>
        <div className="mt-1 text-lg font-semibold">{group?.name}</div>
      </section>

      <section className="mt-4 rounded-lg bg-white p-6 shadow-sm">
        <JoinShare code={group?.join_code ?? ""} url={joinUrl} />
      </section>
    </main>
  );
}
