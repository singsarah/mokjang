import Link from "next/link";
import { loadDashboard } from "@/lib/dashboard";
import { DashboardStats } from "@/components/dashboard-stats";
import { DashboardContact } from "@/components/dashboard-contact";
import { AttendanceTrend } from "@/components/attendance-trend";
import { AttendanceExportButton } from "@/components/attendance-export-button";
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
const navBtn =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-btn border border-border bg-white text-sm text-ink shadow-sm transition hover:bg-card";
const navBtnDisabled =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-btn border border-border bg-white text-sm text-ink-muted opacity-40";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: dateParam } = await searchParams;
  const selectedDate = dateParam && DATE_RE.test(dateParam) ? dateParam : undefined;

  const { summary, canCall, contact, birthdays, trend, unclosedDates } = await loadDashboard(selectedDate);

  // 최신 세션을 보고 있는지 여부(다음 세션이 없으면 최신) — 제목/그래프 강조에 사용.
  const isLatest = !summary || summary.nextDate === null;
  const summaryTitle = isLatest ? "지난 예배 출석" : `${shortDate(summary!.date)} 예배 출석`;

  return (
    <main className="min-h-screen space-y-4 bg-lavender-soft px-6 py-8 pb-36">
      {/* 0. 미마감 알림 — 지난 날짜인데 마감하지 않은 출석 (마감해야 통계·엑셀에 반영) */}
      {unclosedDates.length > 0 && (
        <div className="mx-auto max-w-md rounded-2xl border border-gold bg-gold-soft p-4">
          <p className="text-sm font-bold text-ink">아직 마감하지 않은 출석이 있어요</p>
          <p className="mt-1 text-sm text-ink-muted">마감해야 통계와 엑셀에 반영돼요.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {unclosedDates.map((d) => (
              <Link
                key={d}
                href={`/attendance?date=${d}`}
                className="rounded-btn border border-gold bg-white px-3 py-1 text-sm font-medium text-ink"
              >
                {shortDate(d)} 마감하러 가기 →
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 1. 요약 카드 (세션 없으면 빈 상태) */}
      {summary ? (
        <div className={cardClass}>
          {/* ◀ 제목/날짜 ▶ */}
          <div className="flex items-center justify-between gap-2">
            {summary.prevDate ? (
              <Link href={`/dashboard?date=${summary.prevDate}`} aria-label="이전 예배" className={navBtn}>
                ◀
              </Link>
            ) : (
              <span aria-hidden="true" className={navBtnDisabled}>◀</span>
            )}

            <div className="min-w-0 flex-1 text-center">
              <h1 className="font-display text-lg font-bold text-ink">
                {summaryTitle}
                {!summary.closed && (
                  <span className="ml-2 rounded-tag bg-gold-soft px-2 py-0.5 align-middle text-sm font-medium text-gold-deep">
                    미마감
                  </span>
                )}
              </h1>
              <p className="text-sm text-ink-muted">
                {shortDate(summary.date)}{summary.note ? ` · ${summary.note}` : ""}
              </p>
            </div>

            {summary.nextDate ? (
              <Link href={`/dashboard?date=${summary.nextDate}`} aria-label="다음 예배" className={navBtn}>
                ▶
              </Link>
            ) : (
              <span aria-hidden="true" className={navBtnDisabled}>▶</span>
            )}
          </div>

          {/* 큰 숫자 */}
          <p className="mt-4 text-center font-display text-4xl font-bold text-ink">
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

      {/* 2. 출석 추이 카드 */}
      <div className={cardClass}>
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-ink">출석 추이</h2>
          {canCall && trend.some((p) => p.date != null) && <AttendanceExportButton />}
        </div>
        <AttendanceTrend points={trend} />
      </div>

      {/* 3. 연락필요 카드 */}
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

      {/* 4. 이번달 생일 카드 (학생 + 교사) */}
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
                  {b.who === "student" && (
                    <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${genderDot(b.gender)}`} />
                  )}
                  <span className={`truncate text-sm text-ink ${b.isToday ? "font-bold" : ""}`}>
                    {b.name}
                  </span>
                  <span className={`shrink-0 text-sm ${b.isToday ? "font-bold text-ink" : "text-ink-muted"}`}>
                    {b.month}/{b.day}
                    {b.isToday ? " 🎂" : ""}
                  </span>
                </span>
                <span className="shrink-0 text-sm text-ink-muted">
                  {b.who === "teacher" ? "(교사)" : b.className ? `${b.grade}학년 · ${b.className}` : `${b.grade}학년`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
