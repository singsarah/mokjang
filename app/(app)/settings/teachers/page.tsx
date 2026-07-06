import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership } from "@/lib/memberships";
import { ROLE_LABELS_KO } from "@/lib/constants";
import {
  approveMembership,
  changeRole,
  denyMembership,
  removeMembership,
} from "@/app/actions/memberships";

export default async function TeachersPage() {
  const current = await requireCurrentMembership();
  if (current.role !== "master") redirect("/settings");

  const supabase = await createServerClient();
  const { data: memberships } = await supabase
    .from("memberships")
    .select("id, role, status, user_id")
    .eq("group_id", current.groupId)
    .in("status", ["pending", "active"])
    .order("status", { ascending: true });

  const rows = memberships ?? [];

  // memberships.user_id → auth.users (not profiles), so there is no PostgREST
  // relationship to embed. Fetch the profiles separately and join in memory.
  const userIds = [...new Set(rows.map((m) => m.user_id))];
  const profileRows = userIds.length
    ? (
        await supabase
          .from("profiles")
          .select("id, display_name, email")
          .in("id", userIds)
      ).data ?? []
    : [];
  const profileMap = new Map(profileRows.map((p) => [p.id, p]));

  const pending = rows.filter((m) => m.status === "pending");
  const active = rows.filter((m) => m.status === "active");

  return (
    <main className="mx-auto max-w-2xl px-6 py-6">
      <h1 className="font-display text-2xl font-bold">교사 관리</h1>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">승인 대기 ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">대기 중인 요청이 없습니다.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {pending.map((m) => {
              const profile = profileMap.get(m.user_id);
              return (
                <li
                  key={m.id}
                  className="rounded-lg border bg-white p-4 shadow-sm"
                >
                  <div className="mb-3">
                    <div className="font-medium">
                      {profile?.display_name ?? "(이름 없음)"}
                    </div>
                    <div className="text-xs text-gray-500">{profile?.email}</div>
                  </div>
                  <div className="flex gap-2">
                    <form
                      action={async () => {
                        "use server";
                        await approveMembership({ id: m.id, role: "editor" });
                      }}
                    >
                      <button className="rounded-md bg-pasture-500 px-4 py-2 text-sm text-white">
                        편집 교사로 승인
                      </button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await approveMembership({ id: m.id, role: "viewer" });
                      }}
                    >
                      <button className="rounded-md border border-pasture-500 px-4 py-2 text-sm text-pasture-600">
                        조회 교사로 승인
                      </button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await denyMembership({ id: m.id });
                      }}
                    >
                      <button className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600">
                        반려
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">활성 교사 ({active.length})</h2>
        <ul className="mt-3 space-y-3">
          {active.map((m) => {
            const profile = profileMap.get(m.user_id);
            return (
              <li key={m.id} className="rounded-lg border bg-white p-4 shadow-sm">
                <div className="mb-3">
                  <div className="font-medium">
                    {profile?.display_name ?? "(이름 없음)"}{" "}
                    <span className="ml-2 text-xs text-gray-500">
                      {ROLE_LABELS_KO[m.role]}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">{profile?.email}</div>
                </div>
                {m.role !== "master" && (
                  <div className="flex gap-2">
                    <form
                      action={async () => {
                        "use server";
                        await changeRole({
                          id: m.id,
                          role: m.role === "editor" ? "viewer" : "editor",
                        });
                      }}
                    >
                      <button className="rounded-md border px-3 py-1 text-xs">
                        {m.role === "editor" ? "→ 조회로" : "→ 편집으로"}
                      </button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await removeMembership({ id: m.id });
                      }}
                    >
                      <button className="rounded-md border border-coral-500 px-3 py-1 text-xs text-coral-500">
                        내보내기
                      </button>
                    </form>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
