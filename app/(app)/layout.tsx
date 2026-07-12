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
      {/* 래퍼에 하단 패딩을 주지 않는다 — 각 페이지 main의 pb-24가 탭바 클리어런스라서,
          래퍼 패딩이 있으면 탭바 위로 베이지 띠가 삐져나온다. 푸터는 페이지의
          하단 여백 위에 겹쳐 앉아 그 화면 배경색 그대로 보인다. */}
      <div className="relative min-h-screen bg-bg">
        {children}
        <SiteFooter className="pointer-events-none absolute inset-x-0 bottom-16" />
      </div>
      {demo && <DemoTour />}
      <TabBar />
    </PrivacyGate>
  );
}
