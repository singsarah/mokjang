import { requireCurrentMembership } from "@/lib/memberships";
import { isDemoEmail } from "@/lib/demo";
import { PrivacyGate } from "@/components/privacy-gate";
import { DemoTour } from "@/components/demo-tour";
import { TabBar } from "@/components/tab-bar";
import { SiteFooter } from "@/components/site-footer";

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
      {/* 푸터는 각 페이지의 하단 여백(pb-24) 위에 겹쳐 앉아 페이지 배경색 그대로 보인다. */}
      <div className="relative min-h-screen bg-bg pb-20">
        {children}
        <SiteFooter className="absolute inset-x-0 bottom-20" />
      </div>
      {demo && <DemoTour />}
      <TabBar />
    </PrivacyGate>
  );
}
