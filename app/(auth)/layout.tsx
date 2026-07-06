import { Icon } from "@/components/icon";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-sage-soft px-6 py-12">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <Icon name="cross" size={20} className="mx-auto mb-1 opacity-80" alt="십자가" />
          <Icon name="sheep-face" size={76} className="mx-auto" alt="양 얼굴 로고" />
          <h1 className="mt-2 font-display text-2xl font-bold text-sage-deep">목장 관리</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
