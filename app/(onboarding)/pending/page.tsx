export default function PendingPage() {
  return (
    <div className="rounded-lg bg-white p-8 shadow text-center">
      <div className="mb-3 text-4xl">🐑</div>
      <h2 className="text-xl font-semibold">승인 대기 중</h2>
      <p className="mt-3 text-sm text-gray-600">
        마스터가 승인하면 자동으로 그룹에 참여됩니다. 잠시 후 다시 접속해주세요.
      </p>
    </div>
  );
}
