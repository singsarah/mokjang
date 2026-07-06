import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership } from "@/lib/memberships";

export default async function GroupSettingsPage() {
  const m = await requireCurrentMembership();
  if (m.role !== "master") redirect("/settings");

  const supabase = await createServerClient();
  const { data: group } = await supabase
    .from("groups")
    .select("name, join_code, created_at")
    .eq("id", m.groupId)
    .single();

  return (
    <main className="mx-auto max-w-md px-6 py-6">
      <h1 className="text-2xl font-bold">그룹 관리</h1>

      <section className="mt-8 rounded-lg bg-white p-6 shadow-sm">
        <div className="text-sm text-gray-500">그룹 이름</div>
        <div className="mt-1 text-lg font-semibold">{group?.name}</div>
      </section>

      <section className="mt-4 rounded-lg bg-white p-6 shadow-sm">
        <div className="text-sm text-gray-500">참여 코드</div>
        <div className="mt-1 select-all font-mono text-2xl font-bold tracking-widest text-pasture-600">
          {group?.join_code}
        </div>
        <p className="mt-3 text-xs text-gray-500">
          이 코드를 다른 교사들에게 공유하세요.
        </p>
      </section>
    </main>
  );
}
