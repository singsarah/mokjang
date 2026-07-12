import { PrivacyGate } from "@/components/privacy-gate";
import { SiteFooter } from "@/components/site-footer";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PrivacyGate>
      <div className="min-h-screen bg-sage-soft px-6 py-12">
        <div className="mx-auto max-w-md">
          {children}
          <SiteFooter />
        </div>
      </div>
    </PrivacyGate>
  );
}
