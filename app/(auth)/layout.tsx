export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-pasture-50 px-6 py-12">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-2 text-4xl">🐑</div>
          <h1 className="text-2xl font-bold text-pasture-600">목장 관리</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
