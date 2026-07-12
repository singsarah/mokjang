import { redirect } from "next/navigation";
import { listMyMemberships } from "@/lib/memberships";
import { Icon } from "@/components/icon";

export default async function PendingPage() {
  // 활성 조직이 하나라도 있으면 대기 화면 대신 조직 선택 화면으로
  // (대기 중인 조직은 거기에 "승인 대기 중"으로 표시됨).
  const { memberships } = await listMyMemberships();
  if (memberships.some((m) => m.status === "active")) redirect("/select-group");

  return (
    <div className="rounded-card border border-border/60 bg-white p-8 text-center shadow-sm">
      <div className="mb-3 flex justify-center">
        <Icon name="sheep-face" size={44} alt="양" />
      </div>
      <h2 className="font-display text-xl font-bold text-ink">승인 대기 중</h2>
      <p className="mt-3 text-sm text-ink-muted">
        마스터가 승인하면 자동으로 그룹에 참여됩니다. 잠시 후 다시 접속해주세요.
      </p>
    </div>
  );
}
