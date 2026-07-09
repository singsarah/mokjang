import Link from "next/link";
import { requireCurrentMembership } from "@/lib/memberships";
import { ROLE_LABELS_KO } from "@/lib/constants";
import { signOut } from "@/app/actions/auth";

export default async function SettingsPage() {
  const m = await requireCurrentMembership();
  const isMaster = m.role === "master";

  const items = [
    {
      href: "/settings/roster",
      icon: "📖",
      label: "학적부",
      desc: "학생 명단 관리",
      chip: "bg-sky-soft",
      show: true,
    },
    {
      // 반 관리: 학적부와 동일 규칙(권한 없으면 페이지 자체가 리다이렉트). URL 유지.
      href: "/settings/roster/classes",
      icon: "🗂️",
      label: "반 관리",
      desc: "반 이름 · 담당 선생님",
      chip: "bg-sky-soft",
      show: true,
    },
    {
      href: "/settings/teachers",
      icon: "👥",
      label: "교사 관리",
      desc: "승인 · 역할 · 내보내기",
      chip: "bg-sage-soft",
      show: isMaster,
    },
    {
      href: "/settings/group",
      icon: "🏷️",
      label: "그룹 관리",
      desc: "이름 · 참여 코드",
      chip: "bg-gold-soft",
      show: isMaster,
    },
    {
      href: "/privacy",
      icon: "📋",
      label: "개인정보 처리 방침",
      desc: "수집 항목 · 보관",
      chip: "bg-card",
      show: true,
    },
  ].filter((it) => it.show);

  return (
    <main className="min-h-screen bg-[#E6EAE0] pb-24">
      <div className="mx-auto max-w-md px-6 py-8">
      <h1 className="font-display font-bold text-3xl text-ink">설정</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {m.groupName} · {ROLE_LABELS_KO[m.role]}
      </p>

      <nav className="mt-8 space-y-3">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className="flex items-center gap-4 rounded-card border border-border/60 bg-white p-4 shadow-sm transition hover:shadow-md"
          >
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-btn text-xl ${it.chip}`}
            >
              {it.icon}
            </span>
            <span className="min-w-0">
              <span className="block font-bold text-ink">{it.label}</span>
              <span className="block text-sm text-ink-muted">{it.desc}</span>
            </span>
            <span className="ml-auto text-lg text-ink-muted">›</span>
          </Link>
        ))}
      </nav>

      <form action={signOut} className="mt-10">
        <button className="w-full rounded-btn border border-border bg-white py-3 text-ink-muted transition hover:bg-card">
          로그아웃
        </button>
      </form>
      </div>
    </main>
  );
}
