import { requireCurrentMembership } from "@/lib/memberships";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoEmail } from "@/lib/demo";
import { PrivacyGate } from "@/components/privacy-gate";
import { DemoTour } from "@/components/demo-tour";
import { TabBar } from "@/components/tab-bar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireCurrentMembership(); // redirects if not active member

  // 체험 계정이면 단계 안내 카드를 띄운다.
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const demo = isDemoEmail(user?.email);

  return (
    <PrivacyGate>
      <div className="min-h-screen bg-bg pb-20">{children}</div>
      {demo && <DemoTour />}
      <TabBar />
    </PrivacyGate>
  );
}
