import { requireCurrentMembership } from "@/lib/memberships";
import { PrivacyGate } from "@/components/privacy-gate";
import { TabBar } from "@/components/tab-bar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireCurrentMembership(); // redirects if not active member

  return (
    <PrivacyGate>
      <div className="min-h-screen bg-bg pb-20">{children}</div>
      <TabBar />
    </PrivacyGate>
  );
}
