import { requireCurrentMembership } from "@/lib/memberships";
import { isDemoEmail } from "@/lib/demo";
import { PrivacyGate } from "@/components/privacy-gate";
import { DemoTour } from "@/components/demo-tour";
import { TabBar } from "@/components/tab-bar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const membership = await requireCurrentMembership(); // redirects if not active member

  // 체험 계정이면 단계 안내 카드를 띄운다.
  const demo = isDemoEmail(membership.email);

  return (
    <PrivacyGate>
      <div className="min-h-screen bg-bg pb-20">{children}</div>
      {demo && <DemoTour />}
      <TabBar />
    </PrivacyGate>
  );
}
