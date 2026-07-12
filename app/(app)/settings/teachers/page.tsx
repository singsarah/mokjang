import Link from "next/link";
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
import { linkTeacherAccount, unlinkTeacherAccount } from "@/app/actions/teachers";
import { loadTeachers } from "@/lib/teachers";
import { TeacherExportButton } from "@/components/teacher-export";

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
  // 마스터가 1명뿐이면 그 마스터의 강등 버튼을 숨긴다 (그룹에 마스터가 최소 1명은 있어야 함).
  const masterCount = active.filter((m) => m.role === "master").length;
  const { teachers } = await loadTeachers();

  // 명단 ↔ 계정 연결 상태
  const teacherByUserId = new Map(teachers.filter((t) => t.userId).map((t) => [t.userId!, t]));
  const unlinkedTeachers = teachers.filter((t) => !t.userId);
  // 가입 이름이 명단 이름과 같으면 자동 제안
  const suggestFor = (userId: string) => {
    const display = profileMap.get(userId)?.display_name?.trim();
    return display ? unlinkedTeachers.find((t) => t.name === display) : undefined;
  };
  const selectCls =
    "min-w-0 rounded-btn border border-border bg-white px-2 py-1.5 text-sm text-ink";

  const ROLE_BUTTON_LABELS: Record<string, string> = {
    master: "→ 마스터로",
    editor: "→ 편집으로",
    viewer: "→ 조회로",
  };

  return (
    <main className="min-h-screen bg-card pb-36">
      <div className="mx-auto max-w-md px-6 py-8">
        <Link
          href="/settings"
          className="text-sm text-ink-muted hover:text-ink"
        >
          ← 설정
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-ink">교사 관리</h1>

        <section className="mt-8">
          <h2 className="text-base font-bold text-ink">
            승인 대기 ({pending.length})
          </h2>
          {pending.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">대기 중인 요청이 없습니다.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {pending.map((m) => {
                const profile = profileMap.get(m.user_id);
                const suggested = suggestFor(m.user_id);
                return (
                  <li
                    key={m.id}
                    className="rounded-card border border-border/60 bg-white p-4 shadow-sm"
                  >
                    <div className="mb-3">
                      <div className="font-medium text-ink">
                        {profile?.display_name ?? "(이름 없음)"}
                      </div>
                      <div className="text-sm text-ink-muted">{profile?.email}</div>
                    </div>
                    {/* 승인 + 명단 매칭 한 폼: 셀렉트 값이 두 승인 버튼 모두에 적용된다 */}
                    <form className="space-y-2">
                      {unlinkedTeachers.length > 0 && (
                        <label className="flex items-center gap-2 text-sm text-ink-muted">
                          교사 명단
                          <select name="teacherId" defaultValue={suggested?.id ?? ""} className={selectCls}>
                            <option value="">연결 안 함</option>
                            {unlinkedTeachers.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}{t.duty ? ` (${t.duty})` : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <button
                          formAction={async (formData: FormData) => {
                            "use server";
                            const teacherId = (formData.get("teacherId") as string) || null;
                            await approveMembership({ id: m.id, role: "editor", teacherId });
                          }}
                          className="rounded-btn bg-sage px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sage-deep"
                        >
                          편집 교사로 승인
                        </button>
                        <button
                          formAction={async (formData: FormData) => {
                            "use server";
                            const teacherId = (formData.get("teacherId") as string) || null;
                            await approveMembership({ id: m.id, role: "viewer", teacherId });
                          }}
                          className="rounded-btn border border-sage px-4 py-2 text-sm text-sage-deep transition hover:bg-sage-soft"
                        >
                          조회 교사로 승인
                        </button>
                        <button
                          formAction={async () => {
                            "use server";
                            await denyMembership({ id: m.id });
                          }}
                          className="rounded-btn border border-border px-4 py-2 text-sm text-ink-muted transition hover:bg-card"
                        >
                          반려
                        </button>
                      </div>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-base font-bold text-ink">
            활성 교사 ({active.length})
          </h2>
          <ul className="mt-3 space-y-3">
            {active.map((m) => {
              const profile = profileMap.get(m.user_id);
              const linked = teacherByUserId.get(m.user_id);
              const suggested = suggestFor(m.user_id);
              return (
                <li
                  key={m.id}
                  className="rounded-card border border-border/60 bg-white p-4 shadow-sm"
                >
                  <div className="mb-3">
                    <div className="font-medium text-ink">
                      {profile?.display_name ?? "(이름 없음)"}{" "}
                      <span className="ml-2 rounded-tag bg-sky-soft px-2 py-0.5 text-sm text-ink-muted">
                        {ROLE_LABELS_KO[m.role]}
                      </span>
                    </div>
                    <div className="text-sm text-ink-muted">{profile?.email}</div>
                  </div>
                  {/* 교사 명단 연결 상태 */}
                  <div className="mb-3">
                    {linked ? (
                      <form
                        action={async () => {
                          "use server";
                          await unlinkTeacherAccount({ teacherId: linked.id });
                        }}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span className="rounded-tag bg-sage-soft px-2 py-0.5 text-sage-deep">
                          명단: {linked.name}{linked.duty ? ` (${linked.duty})` : ""}
                        </span>
                        <button className="text-sm text-ink-muted underline underline-offset-2 hover:text-ink">
                          연결 해제
                        </button>
                      </form>
                    ) : unlinkedTeachers.length > 0 ? (
                      <form className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                        교사 명단
                        <select name="teacherId" defaultValue={suggested?.id ?? ""} className={selectCls}>
                          <option value="">선택…</option>
                          {unlinkedTeachers.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}{t.duty ? ` (${t.duty})` : ""}
                            </option>
                          ))}
                        </select>
                        <button
                          formAction={async (formData: FormData) => {
                            "use server";
                            const teacherId = formData.get("teacherId") as string;
                            if (teacherId) await linkTeacherAccount({ teacherId, userId: m.user_id });
                          }}
                          className="rounded-btn border border-border px-3 py-1 text-sm text-ink transition hover:bg-card"
                        >
                          연결
                        </button>
                      </form>
                    ) : (
                      <p className="text-sm text-ink-muted">명단에 연결할 수 있는 교사가 없어요.</p>
                    )}
                  </div>
                  {(m.role !== "master" || masterCount > 1) && (
                    <div className="flex flex-wrap gap-2">
                      {(["master", "editor", "viewer"] as const)
                        .filter((r) => r !== m.role)
                        .map((r) => (
                          <form
                            key={r}
                            action={async () => {
                              "use server";
                              await changeRole({ id: m.id, role: r });
                            }}
                          >
                            <button className="rounded-btn border border-border px-3 py-1 text-sm text-ink transition hover:bg-card">
                              {ROLE_BUTTON_LABELS[r]}
                            </button>
                          </form>
                        ))}
                      {m.role !== "master" && (
                        <form
                          action={async () => {
                            "use server";
                            await removeMembership({ id: m.id });
                          }}
                        >
                          <button className="rounded-btn border border-danger px-3 py-1 text-sm text-danger transition hover:bg-unconfirmed-soft">
                            내보내기
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* 교사 명단 (인적사항 — 계정 유무와 무관) */}
        <section className="mt-10">
          <h2 className="text-base font-bold text-ink">교사 명단 ({teachers.length})</h2>
          {/* 버튼 3개 동일 크기·좌우 정렬 (섹션 폭을 3등분) */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Link
              href="/settings/teachers/roster/import"
              className="rounded-btn border border-transparent bg-sage-deep px-2 py-2 text-center text-sm font-medium text-white shadow-sm transition hover:bg-sage"
            >
              엑셀 업로드
            </Link>
            <Link
              href="/settings/teachers/roster/new"
              className="rounded-btn border border-transparent bg-sage px-2 py-2 text-center text-sm font-medium text-white shadow-sm transition hover:bg-sage-deep"
            >
              + 교사 추가
            </Link>
            {/* 전체 명단 내보내기: 이 섹션 전체가 master 전용(페이지 상단에서 redirect). */}
            <TeacherExportButton />
          </div>
          {teachers.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">
              아직 등록된 교사가 없어요. 엑셀 업로드로 한 번에 등록할 수 있어요.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {teachers.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/settings/teachers/roster/${t.id}`}
                    className="flex items-center justify-between rounded-card border border-border/60 bg-white p-3 shadow-sm transition hover:shadow-md"
                  >
                    <span className="text-ink">
                      {t.name}
                      {t.duty && <span className="ml-2 text-sm text-ink-muted">{t.duty}</span>}
                      {t.userId && (
                        <span className="ml-2 rounded-tag bg-sage-soft px-2 py-0.5 text-sm text-sage-deep">
                          계정 연결됨
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-2 text-sm text-ink-muted">
                      {t.phone && <span>{t.phone}</span>}
                      <span className="text-lg">›</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
