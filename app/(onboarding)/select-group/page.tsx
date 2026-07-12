import Link from "next/link";
import { listMyMemberships } from "@/lib/memberships";
import { setCurrentGroup } from "@/app/actions/group-select";
import { signOut } from "@/app/actions/auth";
import { ROLE_LABELS_KO } from "@/lib/constants";
import { Icon } from "@/components/icon";

// 조직 선택 화면 — 로그인 후 입구. 내 조직(1개든 여러 개든)을 눌러 들어간다.
// 조직이 없으면 만들기/참여 안내가 뜬다.
export default async function SelectGroupPage() {
  const { memberships } = await listMyMemberships();
  const active = memberships.filter((m) => m.status === "active");
  const pending = memberships.filter((m) => m.status === "pending");

  return (
    <div>
      <div className="mb-6 text-center">
        <Icon name="sheep-face" size={56} className="mx-auto" alt="양 얼굴 로고" />
        <h1 className="mt-2 font-display text-2xl font-bold text-ink">
          {active.length > 0 ? "어느 조직으로 들어갈까요?" : "환영해요!"}
        </h1>
        {active.length === 0 && pending.length === 0 && (
          <p className="mt-2 text-sm text-ink-muted">
            아직 소속된 조직이 없어요. 새 조직을 만들거나, 받은 초대 코드로 참여하세요.
          </p>
        )}
      </div>

      {active.length > 0 && (
        <ul className="space-y-3">
          {active.map((m) => (
            <li key={m.groupId}>
              <form
                action={async () => {
                  "use server";
                  await setCurrentGroup({ groupId: m.groupId });
                }}
              >
                <button
                  aria-label={`조직 선택: ${m.groupName}`}
                  className="flex w-full items-center justify-between rounded-card border border-border/60 bg-white p-5 text-left shadow-sm transition hover:shadow-md"
                >
                  <span>
                    <span className="block font-display text-lg font-bold text-ink">
                      {m.groupName}
                    </span>
                    <span className="mt-0.5 block text-sm text-ink-muted">
                      {ROLE_LABELS_KO[m.role]}
                    </span>
                  </span>
                  <span className="text-lg text-ink-muted">›</span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {pending.length > 0 && (
        <ul className="mt-3 space-y-3">
          {pending.map((m) => (
            <li
              key={m.groupId}
              className="flex items-center justify-between rounded-card border border-border/60 bg-white/60 p-5"
            >
              <span className="font-display text-lg font-bold text-ink-muted">
                {m.groupName}
              </span>
              <span className="rounded-tag bg-gold-soft px-2 py-0.5 text-sm text-ink-muted">
                승인 대기 중
              </span>
            </li>
          ))}
        </ul>
      )}

      {active.length === 0 && pending.length === 0 ? (
        <div className="space-y-3">
          <Link
            href="/new-group"
            className="block w-full rounded-card border border-border/60 bg-white p-5 text-center shadow-sm transition hover:shadow-md"
          >
            <span className="block font-display text-lg font-bold text-sage-deep">
              새 조직 만들기
            </span>
            <span className="mt-0.5 block text-sm text-ink-muted">
              마스터가 되어 우리 조직을 시작해요
            </span>
          </Link>
          <Link
            href="/join"
            className="block w-full rounded-card border border-border/60 bg-white p-5 text-center shadow-sm transition hover:shadow-md"
          >
            <span className="block font-display text-lg font-bold text-ink">
              초대 코드로 참여
            </span>
            <span className="mt-0.5 block text-sm text-ink-muted">
              마스터에게 받은 8자리 코드를 입력해요
            </span>
          </Link>
        </div>
      ) : (
        <p className="mt-6 text-center text-sm text-ink-muted">
          <Link href="/new-group" className="underline underline-offset-2 hover:text-ink">
            새 조직 만들기
          </Link>
          {" · "}
          <Link href="/join" className="underline underline-offset-2 hover:text-ink">
            초대 코드로 참여
          </Link>
        </p>
      )}

      <form action={signOut} className="mt-8 text-center">
        <button className="text-sm text-ink-muted underline underline-offset-2 hover:text-ink">
          로그아웃
        </button>
      </form>
    </div>
  );
}
