export default function PendingPage() {
  return (
    <div className="rounded-card border border-border/60 bg-white p-8 text-center shadow-sm">
      <div className="mb-3 text-4xl">🐑</div>
      <h2 className="font-display text-xl font-bold text-ink">승인 대기 중</h2>
      <p className="mt-3 text-sm text-ink-muted">
        마스터가 승인하면 자동으로 그룹에 참여됩니다. 잠시 후 다시 접속해주세요.
      </p>
    </div>
  );
}
