import { loadDashboard } from "@/lib/dashboard";
import { DashboardStats } from "@/components/dashboard-stats";
import { DashboardContact } from "@/components/dashboard-contact";
import { CakeIcon } from "@/components/flat-icons";

// "YYYY-MM-DD" → "M/D"
function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${m}/${d}`;
}

// 성별 점 색 (dashboard-stats 관례와 동일)
const genderDot = (gender: string | null) =>
  gender === "female" ? "bg-pink-400" : gender === "male" ? "bg-sky-400" : "bg-transparent border border-border";

const cardClass = "mx-auto max-w-md rounded-2xl border border-border bg-white p-6 shadow-sm";

export default async function DashboardPage() {
  const { summary, canCall, contact, birthdays } = await loadDashboard();

  return (
    <main className="min-h-screen space-y-4 bg-bg px-6 py-8 pb-24">
      {/* 1. 요약 카드 (세션 없으면 빈 상태) */}
      {summary ? (
        <div className={cardClass}>
          {/* 날짜 + note */}
          <div className="flex items-baseline justify-between">
            <h1 className="font-display text-lg font-bold text-ink">지난 예배 출석</h1>
            <span className="text-sm text-ink-muted">
              {shortDate(summary.date)}{summary.note ? ` · ${summary.note}` : ""}
            </span>
          </div>

          {/* 큰 숫자 */}
          <p className="mt-4 font-display text-4xl font-bold text-ink">
            출석 {summary.present}
            <span className="text-2xl text-ink-muted"> / {summary.total}</span>
          </p>

          {/* 3칸 미니 통계 (탭하면 명단 펼침) */}
          <DashboardStats
            present={summary.present}
            reason={summary.reason}
            unconfirmed={summary.unconfirmed}
            presentList={summary.presentList}
            reasonList={summary.reasonList}
            unconfirmedList={summary.unconfirmedList}
          />

          {/* 반별 한 줄 */}
          {summary.classSummaries.length > 0 && (
            <p className="mt-4 text-sm text-ink-muted">
              {summary.classSummaries.map((c) => `${c.name} ${c.present}/${c.total}`).join(" · ")}
            </p>
          )}
        </div>
      ) : (
        <div className={`${cardClass} text-center`}>
          <div className="text-6xl">🐑</div>
          <h1 className="mt-4 font-display text-xl font-bold text-ink">아직 예배 기록이 없어요</h1>
          <p className="mt-2 text-sm text-ink-muted">출석을 체크하면 여기에 요약이 나타나요.</p>
        </div>
      )}

      {/* 2. 연락필요 카드 */}
      <div className={cardClass}>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg font-bold text-ink">연락필요</h2>
          <span className="text-sm text-ink-muted">미확인 학생</span>
        </div>
        {contact.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">연락할 학생이 없어요 🐑</p>
        ) : (
          <DashboardContact canCall={canCall} contact={contact} />
        )}
      </div>

      {/* 3. 이번달 생일 카드 */}
      <div className={cardClass}>
        <h2 className="flex items-center gap-1.5 font-display text-lg font-bold text-ink">
          이번달 생일 <CakeIcon className="inline-block h-[1.1em] w-[1.1em] text-gold-deep" />
        </h2>
        {birthdays.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">이번 달 생일자가 없어요.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {birthdays.map((b, i) => (
              <li key={i} className="flex items-center justify-between gap-2 py-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${genderDot(b.gender)}`} />
                  <span className={`truncate text-sm text-ink ${b.isToday ? "font-bold" : ""}`}>
                    {b.name}
                  </span>
                  <span className={`shrink-0 text-sm ${b.isToday ? "font-bold text-ink" : "text-ink-muted"}`}>
                    {b.month}/{b.day}
                    {b.isToday ? " 🎂" : ""}
                  </span>
                </span>
                <span className="shrink-0 text-sm text-ink-muted">
                  {b.className ? `${b.grade}학년 · ${b.className}` : `${b.grade}학년`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
