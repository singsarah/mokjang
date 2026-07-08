"use client";

import { useState } from "react";

type Sel = "present" | "reason" | "unconfirmed" | null;

type StudentEntry = { name: string; gender: string | null; grade: number; className: string | null; reason: string | null };

export function DashboardStats({
  present,
  reason,
  unconfirmed,
  presentList,
  reasonList,
  unconfirmedList,
}: {
  present: number;
  reason: number;
  unconfirmed: number;
  presentList: StudentEntry[];
  reasonList: StudentEntry[];
  unconfirmedList: StudentEntry[];
}) {
  const [sel, setSel] = useState<Sel>(null);
  const toggle = (s: Exclude<Sel, null>) => setSel((cur) => (cur === s ? null : s));

  return (
    <div className="mt-5">
      {/* 3칸 미니 통계 */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <button
          type="button"
          aria-expanded={sel === "present"}
          onClick={() => toggle("present")}
          className={`rounded-btn bg-sage-soft py-3 ${sel === "present" ? "ring-2 ring-sage" : ""}`}
        >
          <p className="font-display text-2xl font-bold text-sage-deep">{present}</p>
          <p className="text-xs text-ink-muted">출석</p>
        </button>
        <button
          type="button"
          aria-expanded={sel === "reason"}
          onClick={() => toggle("reason")}
          className={`rounded-btn bg-gold-soft py-3 ${sel === "reason" ? "ring-2 ring-gold" : ""}`}
        >
          <p className="font-display text-2xl font-bold text-gold-deep">{reason}</p>
          <p className="text-xs text-ink-muted">사유결석</p>
        </button>
        <button
          type="button"
          aria-expanded={sel === "unconfirmed"}
          onClick={() => toggle("unconfirmed")}
          className={`rounded-btn bg-unconfirmed-soft py-3 ${sel === "unconfirmed" ? "ring-2 ring-unconfirmed" : ""}`}
        >
          <p className="font-display text-2xl font-bold text-unconfirmed">{unconfirmed}</p>
          <p className="text-xs text-ink-muted">미확인</p>
        </button>
      </div>

      {/* 펼침 명단 */}
      {sel === "present" && <NameList soft="bg-sage-soft" entries={presentList} />}
      {sel === "reason" && <NameList soft="bg-gold-soft" entries={reasonList} />}
      {sel === "unconfirmed" && <NameList soft="bg-unconfirmed-soft" entries={unconfirmedList} />}
    </div>
  );
}

// 성별 점 색 (class-detail 패턴과 동일)
const genderDot = (gender: string | null) =>
  gender === "female" ? "bg-pink-400" : gender === "male" ? "bg-sky-400" : "bg-transparent border border-border";

function NameList({ soft, entries }: { soft: string; entries: StudentEntry[] }) {
  return (
    <div className={`mt-2 rounded-btn ${soft} px-3 py-1`}>
      {entries.length === 0 ? (
        <p className="py-1.5 text-sm text-ink-muted">없음</p>
      ) : (
        <ul className="divide-y divide-border">
          {entries.map((e, i) => (
            <li key={i} className="flex items-center justify-between gap-2 py-1.5">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${genderDot(e.gender)}`} />
                <span className="truncate text-sm text-ink">
                  {e.reason ? `${e.name} — ${e.reason}` : e.name}
                </span>
              </span>
              <span className="shrink-0 text-xs text-ink-muted">
                {e.className ? `${e.grade}학년 · ${e.className}` : `${e.grade}학년`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
