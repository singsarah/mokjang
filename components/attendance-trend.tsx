"use client";

import { useState } from "react";
import type { TrendPoint } from "@/lib/dashboard";

// "YYYY-MM-DD" → "M/D"
function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${m}/${d}`;
}

const CHART_W = 320;
const CHART_H = 150;
const PAD_TOP = 22; // 막대 값 라벨 공간
const PAD_BOTTOM = 22; // x축 날짜 라벨 공간
const PAD_LEFT = 26; // y축 인원수 눈금 공간
const PAD_RIGHT = 4;
const CORNER = 3; // 막대 상단 둥근 모서리
const MIN_BAR_H = 2; // 0명이어도 보이도록 최소 높이

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

type Mode = "present" | "absent";

// 출석 추이 — 이번주 포함 4주 고정 막대 그래프 (인라인 SVG, 차트 라이브러리 미사용).
// 출석/결석 토글: 결석은 사유결석(노랑)+미확인(빨강) 스택, 라벨은 합계.
export function AttendanceTrend({ points }: { points: TrendPoint[] }) {
  const [mode, setMode] = useState<Mode>("present");

  if (points.length === 0) {
    return <p className="mt-3 text-sm text-ink-muted">아직 출석 기록이 없어요</p>;
  }

  const value = (p: TrendPoint) => (mode === "present" ? p.present : p.reason + p.unconfirmed);
  const maxValue = Math.max(...points.filter((p) => p.date != null).map(value), 1);

  const n = points.length;
  const plotW = CHART_W - PAD_LEFT - PAD_RIGHT;
  const plotH = CHART_H - PAD_TOP - PAD_BOTTOM;
  const baselineY = CHART_H - PAD_BOTTOM;
  const slotW = plotW / n;
  const barW = Math.min(40, slotW * 0.6);

  const toggleBtn = (m: Mode, label: string) => (
    <button
      type="button"
      aria-pressed={mode === m}
      onClick={() => setMode(m)}
      className={`rounded-btn py-1.5 text-sm transition ${
        mode === m ? "bg-white font-bold text-ink shadow-sm" : "text-ink-muted"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mt-3">
      {/* 출석/결석 토글 */}
      <div className="grid grid-cols-2 gap-1 rounded-btn bg-card p-1">
        {toggleBtn("present", "출석")}
        {toggleBtn("absent", "결석")}
      </div>

      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="mt-2 w-full" role="img" aria-label="출석 추이 그래프">
        {/* 최대값 기준선 + 베이스라인 */}
        <line x1={PAD_LEFT} y1={PAD_TOP} x2={CHART_W - PAD_RIGHT} y2={PAD_TOP} stroke="currentColor" strokeWidth="1" className="text-border" />
        <line x1={PAD_LEFT} y1={baselineY} x2={CHART_W - PAD_RIGHT} y2={baselineY} stroke="currentColor" strokeWidth="1" className="text-border" />
        {/* y축 인원수 눈금 */}
        <text x={PAD_LEFT - 6} y={PAD_TOP + 4} textAnchor="end" fill="currentColor" className="text-sm text-ink-muted">
          {maxValue}
        </text>
        <text x={PAD_LEFT - 6} y={baselineY + 4} textAnchor="end" fill="currentColor" className="text-sm text-ink-muted">
          0
        </text>

        {points.map((p, i) => {
          const cx = PAD_LEFT + i * slotW + slotW / 2;
          const x = cx - barW / 2;
          const labelX = cx;

          // 빈 주(마감된 출석 없음): 막대·값 라벨 없이 날짜만 흐리게.
          if (p.date == null) {
            return (
              <text key={p.weekStart} x={labelX} y={CHART_H - 4} textAnchor="middle" fill="currentColor" className="text-sm text-ink-muted opacity-50">
                {shortDate(p.weekStart)}
              </text>
            );
          }

          const v = value(p);
          const h = Math.max(MIN_BAR_H, (v / maxValue) * plotH);
          const y = baselineY - h;
          const title =
            mode === "present"
              ? `${shortDate(p.date)} 출석 ${p.present}/${p.total}`
              : `${shortDate(p.date)} 결석 ${v} (사유 ${p.reason} · 미확인 ${p.unconfirmed})`;

          // 결석 스택: 아래 사유결석(노랑) + 위 미확인(빨강). 상단 세그먼트만 둥근 모서리.
          const reasonH = v > 0 ? (p.reason / v) * h : 0;
          const unconfirmedH = h - reasonH;

          return (
            <g key={p.weekStart}>
              {mode === "present" ? (
                <path d={roundedTopBarPath(x, y, barW, h, CORNER)} fill="currentColor" className="text-sage-deep">
                  <title>{title}</title>
                </path>
              ) : (
                <g>
                  {unconfirmedH > 0 && (
                    <path d={roundedTopBarPath(x, y, barW, unconfirmedH, CORNER)} fill="currentColor" className="text-unconfirmed" />
                  )}
                  {reasonH > 0 &&
                    (unconfirmedH > 0 ? (
                      <rect x={x} y={baselineY - reasonH} width={barW} height={reasonH} fill="currentColor" className="text-gold-deep" />
                    ) : (
                      <path d={roundedTopBarPath(x, y, barW, h, CORNER)} fill="currentColor" className="text-gold-deep" />
                    ))}
                  {v === 0 && (
                    <path d={roundedTopBarPath(x, y, barW, h, CORNER)} fill="currentColor" className="text-gold-deep" />
                  )}
                  <title>{title}</title>
                </g>
              )}
              <text x={labelX} y={Math.max(12, y - 6)} textAnchor="middle" fill="currentColor" className="text-sm font-bold text-ink">
                {v}
              </text>
              <text x={labelX} y={CHART_H - 4} textAnchor="middle" fill="currentColor" className="text-sm text-ink-muted">
                {shortDate(p.date)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* 결석 모드 범례 */}
      {mode === "absent" && (
        <p className="mt-1 flex items-center justify-end gap-3 text-sm text-ink-muted">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-gold-deep" /> 사유결석
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-unconfirmed" /> 미확인
          </span>
        </p>
      )}
    </div>
  );
}
