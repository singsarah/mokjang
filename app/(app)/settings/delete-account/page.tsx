import Link from "next/link";
import { requireCurrentMembership } from "@/lib/memberships";
import { DeleteAccountButton } from "@/components/delete-account-button";

export default async function DeleteAccountPage() {
  const m = await requireCurrentMembership();
  const isMaster = m.role === "master";

  return (
    <main className="min-h-screen bg-card pb-24">
      <div className="mx-auto max-w-md px-6 py-8">
        <Link href="/settings" className="text-sm text-ink-muted hover:text-ink">
          ← 설정
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-ink">계정 삭제</h1>

        <div className="mt-6 rounded-card border border-danger/30 bg-white p-5 shadow-sm">
          <p className="font-medium text-ink">계정을 삭제하면:</p>
          <ul className="ml-5 mt-3 list-disc space-y-2 text-sm text-ink">
            <li>계정 정보(이름 · 이메일 · 프로필)가 즉시 완전히 삭제돼요.</li>
            <li>
              <strong>혼자 사용 중인 그룹</strong>은 그룹에 기록된 모든 정보(학생 명단 ·
              출석 기록 · 일정 · 회의록 · 교사 명단)가 함께 삭제돼요.
            </li>
            <li>
              다른 교사와 함께 쓰는 그룹에서는 탈퇴 처리되고, 그룹의 기록은 남은
              교사들을 위해 유지돼요. 기록에 남아 있던 내 계정 연결은 모두 익명화돼요.
            </li>
            <li>삭제 후에는 되돌릴 수 없어요.</li>
          </ul>
          {isMaster && (
            <p className="mt-3 rounded-btn bg-gold-soft px-3 py-2 text-sm text-ink">
              지금 마스터로 있는 그룹에 다른 교사가 있다면, 먼저 교사 관리에서 다른
              교사를 마스터로 임명해야 계정을 삭제할 수 있어요.
            </p>
          )}
        </div>

        <DeleteAccountButton />
      </div>
    </main>
  );
}
