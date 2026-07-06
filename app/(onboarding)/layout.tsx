import { PrivacyGate } from "@/components/privacy-gate";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PrivacyGate>
      <div className="min-h-screen bg-pasture-50 px-6 py-12">
        <div className="mx-auto max-w-md">{children}</div>
      </div>
    </PrivacyGate>
  );
}
