import { loadDashboard } from "@/lib/dashboard";
import { DashboardStats } from "@/components/dashboard-stats";

// "YYYY-MM-DD" → "M/D"
function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${m}/${d}`;
}

export default async function DashboardPage() {
  const data = await loadDashboard();

  if (!data) {
    return (
      <main className="min-h-screen bg-bg px-6 py-8 pb-24 text-center">
        <div className="mt-16 text-6xl">🐑</div>
        <h1 className="mt-4 font-display text-xl font-bold text-ink">아직 예배 기록이 없어요</h1>
        <p className="mt-2 text-sm text-ink-muted">출석을 체크하면 여기에 요약이 나타나요.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg px-6 py-8 pb-24">
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-white p-6 shadow-sm">
        {/* 날짜 + note */}
        <div className="flex items-baseline justify-between">
          <h1 className="font-display text-lg font-bold text-ink">지난 예배 출석</h1>
          <span className="text-sm text-ink-muted">
            {shortDate(data.date)}{data.note ? ` · ${data.note}` : ""}
          </span>
        </div>

        {/* 큰 숫자 */}
        <p className="mt-4 font-display text-4xl font-bold text-ink">
          출석 {data.present}
          <span className="text-2xl text-ink-muted"> / {data.total}</span>
        </p>

        {/* 3칸 미니 통계 (탭하면 명단 펼침) */}
        <DashboardStats
          present={data.present}
          reason={data.reason}
          unconfirmed={data.unconfirmed}
          presentList={data.presentList}
          reasonList={data.reasonList}
          unconfirmedList={data.unconfirmedList}
        />

        {/* 반별 한 줄 */}
        {data.classSummaries.length > 0 && (
          <p className="mt-4 text-sm text-ink-muted">
            {data.classSummaries.map((c) => `${c.name} ${c.present}/${c.total}`).join(" · ")}
          </p>
        )}
      </div>
    </main>
  );
}
