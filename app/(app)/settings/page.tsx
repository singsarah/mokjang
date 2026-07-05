import Link from "next/link";
import { requireCurrentMembership } from "@/lib/memberships";
import { ROLE_LABELS_KO } from "@/lib/constants";
import { signOut } from "@/app/actions/auth";

export default async function SettingsPage() {
  const m = await requireCurrentMembership();
  return (
    <main className="px-6 py-6">
      <h1 className="text-2xl font-bold">설정</h1>
      <p className="mt-1 text-sm text-gray-600">
        {m.groupName} · {ROLE_LABELS_KO[m.role]}
      </p>

      <nav className="mt-8 space-y-2">
        {m.role === "master" && (
          <>
            <Link
              href="/settings/teachers"
              className="block rounded-lg bg-white p-4 shadow-sm hover:bg-pasture-50"
            >
              👥 교사 관리
            </Link>
            <Link
              href="/settings/group"
              className="block rounded-lg bg-white p-4 shadow-sm hover:bg-pasture-50"
            >
              🏷️ 그룹 관리 (이름, 코드)
            </Link>
          </>
        )}
        <Link
          href="/privacy"
          className="block rounded-lg bg-white p-4 shadow-sm hover:bg-pasture-50"
        >
          📋 개인정보 처리 방침
        </Link>
      </nav>

      <form action={signOut} className="mt-10">
        <button className="w-full rounded-lg border border-gray-300 py-3 text-gray-700">
          로그아웃
        </button>
      </form>
    </main>
  );
}
