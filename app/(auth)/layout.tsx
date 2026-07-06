export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-sage-soft px-6 py-12">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-2 text-4xl">🐑</div>
          <h1 className="font-display text-2xl font-bold text-sage-deep">목장 관리</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
