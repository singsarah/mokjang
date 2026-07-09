import type { TrendPoint } from "@/lib/dashboard";

// "YYYY-MM-DD" → "M/D"
function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${m}/${d}`;
}

const CHART_W = 320;
const CHART_H = 140;
const PAD_TOP = 22; // 최근 막대 값 라벨 공간
const PAD_BOTTOM = 22; // x축 날짜 라벨 공간
const PAD_X = 4;
const GAP = 4; // 막대 사이 간격
const CORNER = 3; // 막대 상단 둥근 모서리
const MIN_BAR_H = 2; // 0명이어도 탭 가능하도록 최소 높이

// 상단이 둥근 막대 path.
function roundedTopBarPath(x: number, y: number, w: number, h: number, r: number): string {
  const radius = Math.max(0, Math.min(r, w / 2, h));
  const bottom = y + h;
  if (radius <= 0) return `M ${x} ${bottom} L ${x} ${y} L ${x + w} ${y} L ${x + w} ${bottom} Z`;
  return [
    `M ${x} ${bottom}`,
    `L ${x} ${y + radius}`,
    `Q ${x} ${y} ${x + radius} ${y}`,
    `L ${x + w - radius} ${y}`,
    `Q ${x + w} ${y} ${x + w} ${y + radius}`,
    `L ${x + w} ${bottom}`,
    "Z",
  ].join(" ");
}

// 출석 추이 막대 그래프 (서버 렌더 인라인 SVG, 차트 라이브러리 미사용).
// highlightDate: 요약 카드가 과거 세션을 보여줄 때 그 날짜 막대를 강조(금색).
export function AttendanceTrend({ points, highlightDate }: { points: TrendPoint[]; highlightDate?: string | null }) {
  if (points.length === 0) {
    return <p className="mt-3 text-sm text-ink-muted">아직 출석 기록이 없어요</p>;
  }

  const n = points.length;
  const maxPresent = Math.max(...points.map((p) => p.present), 1);
  const plotW = CHART_W - PAD_X * 2;
  const plotH = CHART_H - PAD_TOP - PAD_BOTTOM;
  const barW = Math.max(2, (plotW - GAP * (n - 1)) / n);
  const baselineY = CHART_H - PAD_BOTTOM;

  const tickIdx = new Set<number>([0, Math.floor((n - 1) / 2), n - 1]);
  const lastIdx = n - 1;

  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="mt-3 w-full" role="img" aria-label="출석 추이 그래프">
      {/* 최대값 기준선 */}
      <line x1={PAD_X} y1={PAD_TOP} x2={CHART_W - PAD_X} y2={PAD_TOP} stroke="currentColor" strokeWidth="1" className="text-border" />
      {/* 베이스라인 */}
      <line x1={PAD_X} y1={baselineY} x2={CHART_W - PAD_X} y2={baselineY} stroke="currentColor" strokeWidth="1" className="text-border" />

      {points.map((p, i) => {
        const x = PAD_X + i * (barW + GAP);
        const rawH = (p.present / maxPresent) * plotH;
        const h = Math.max(MIN_BAR_H, rawH);
        const y = baselineY - h;
        const isLast = i === lastIdx;
        const isHighlighted = !isLast && highlightDate != null && p.date === highlightDate;
        return (
          <g key={p.date}>
            <path
              d={roundedTopBarPath(x, y, barW, h, CORNER)}
              fill="currentColor"
              className={isHighlighted ? "text-gold-deep" : "text-sage-deep"}
            >
              <title>{`${shortDate(p.date)} 출석 ${p.present}/${p.total}`}</title>
            </path>
            {isLast && (
              <text x={x + barW / 2} y={Math.max(12, y - 6)} textAnchor="middle" fill="currentColor" className="text-sm font-bold text-ink">
                {p.present}
              </text>
            )}
            {tickIdx.has(i) && (
              <text x={x + barW / 2} y={CHART_H - 4} textAnchor="middle" fill="currentColor" className="text-sm text-ink-muted">
                {shortDate(p.date)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
