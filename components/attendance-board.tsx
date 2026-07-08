"use client";

import { useMemo, useState } from "react";
import {
  displayStatus,
  tapAction,
  reasonAction,
  type BoardClass,
  type BoardRecord,
  type BoardStudent,
  type DisplayStatus,
} from "@/lib/attendance-cycle";
import { setAttendance, clearAttendance } from "@/app/actions/attendance";

function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}

type RecMap = Record<string, BoardRecord>;

export function AttendanceBoard({
  date,
  note,
  canEdit,
  classes,
  students,
  initialRecords,
}: {
  date: string;
  note: string;
  canEdit: boolean;
  classes: BoardClass[];
  students: BoardStudent[];
  initialRecords: RecMap;
}) {
  const [records, setRecords] = useState<RecMap>(initialRecords);
  const [error, setError] = useState<string>();

  // 탭: 반 목록 + "반 없음"(미배정 학생 있을 때)
  const tabs = useMemo(() => {
    const t: { id: string | null; name: string; teacherName: string | null }[] = classes.map((c) => ({
      id: c.id, name: c.name, teacherName: c.teacherName,
    }));
    if (students.some((s) => !s.classId)) t.push({ id: null, name: "반 없음", teacherName: null });
    return t;
  }, [classes, students]);

  const [activeTab, setActiveTab] = useState<string | null>(tabs[0]?.id ?? null);
  const activeClass = tabs.find((t) => t.id === activeTab) ?? tabs[0];
  const shown = students.filter((s) => (s.classId ?? null) === (activeTab ?? null));

  async function apply(studentId: string, next: RecMap, action: Promise<{ error?: string }>) {
    const prev = records;
    setRecords(next);
    setError(undefined);
    const result = await action;
    if (result?.error) {
      setRecords(prev); // 롤백
      setError("저장에 실패했어요. 다시 시도해주세요.");
    }
  }

  function onTap(studentId: string) {
    if (!canEdit) return;
    if (tapAction(records[studentId]) === "clear") {
      const nr = { ...records };
      delete nr[studentId];
      void apply(studentId, nr, clearAttendance({ dateISO: date, studentId }));
    } else {
      const nr = { ...records, [studentId]: { status: "present" as const, reason: null } };
      void apply(studentId, nr, setAttendance({ dateISO: date, studentId, status: "present", reason: null }));
    }
  }

  function onReason(studentId: string, reason: string) {
    if (!canEdit) return;
    const a = reasonAction(reason);
    if (a.kind === "clear") {
      const nr = { ...records };
      delete nr[studentId];
      void apply(studentId, nr, clearAttendance({ dateISO: date, studentId }));
    } else {
      const nr = { ...records, [studentId]: { status: "absent_with_reason" as const, reason: a.reason } };
      void apply(studentId, nr, setAttendance({ dateISO: date, studentId, status: "absent_with_reason", reason: a.reason }));
    }
  }

  const sheepCls = (d: DisplayStatus) =>
    d === "present" ? "bg-sage-deep text-white border-[#3c5238]"
    : d === "absent_with_reason" ? "bg-gold border-gold-deep text-ink"
    : d === "unconfirmed" ? "bg-danger text-white border-[#b64a45]"
    : "bg-[#FBEEE6] text-ink border-[rgba(58,50,46,.35)]"; // unchecked(흰)

  return (
    // 화면 전체가 푸른 풀밭 (크림색 바탕 없음)
    <main className="min-h-screen pb-24" style={{ background: "linear-gradient(180deg,#5F9E93 0%,#7DA98A 42%,#98BE86 100%)" }}>
      {/* 손그림 러프 필터 (1회) */}
      <svg width="0" height="0" className="absolute">
        <filter id="rough">
          <feTurbulence type="fractalNoise" baseFrequency="0.018 0.03" numOctaves={2} seed={7} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={6} />
        </filter>
      </svg>

      <div className="mx-auto max-w-md">
        {/* 상단 날짜/세션 */}
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <a href={`/attendance?date=${shiftDate(date, -1)}`} className="text-lg text-[#F3E2CE]">◀</a>
            <span className="font-bold text-[#FDF3E7]">{date}</span>
            <a href={`/attendance?date=${shiftDate(date, 1)}`} className="text-lg text-[#F3E2CE]">▶</a>
          </div>
          <span className="rounded-tag bg-gold-soft px-3 py-1 text-xs text-ink-muted">{note}</span>
        </div>

        {/* 반 탭 */}
        <div className="flex gap-2 overflow-x-auto px-5 pb-2">
          {tabs.map((t) => (
            <button
              key={t.id ?? "none"}
              onClick={() => setActiveTab(t.id)}
              className={`shrink-0 rounded-btn px-3 py-1.5 text-sm ${
                (t.id ?? null) === (activeTab ?? null)
                  ? "bg-sage-deep font-bold text-white"
                  : "border border-border bg-white text-ink-muted"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>

        {/* 범례 */}
        <div className="flex flex-wrap justify-center gap-3 px-5 pb-2 text-[11px] text-[#FDF3E7]">
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full border border-[#b9a99a] bg-[#FBEEE6] align-middle" />미체크</span>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-sage-deep align-middle" />출석</span>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-gold align-middle" />사유결석</span>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-danger align-middle" />연락필요</span>
        </div>

        {error && <p className="mx-5 rounded-btn bg-white px-3 py-1 text-sm text-danger">{error}</p>}

        {/* 목장 씬 */}
        <div className="relative px-3 pb-6 pt-3">
          {/* 나무 팻말 */}
          {activeClass && (
            <div className="relative z-10 mx-auto w-52">
              <div className="flex justify-between px-9"><span className="block h-3.5 w-0.5 bg-[#7d5537]" /><span className="block h-3.5 w-0.5 bg-[#7d5537]" /></div>
              <div className="absolute inset-x-0 bottom-0 top-3.5 rounded-lg border-[3px] border-[#7d5537] bg-[#9a6a48]" style={{ filter: "url(#rough)" }} />
              <div className="relative flex items-baseline justify-center gap-2 px-2 pb-2.5 pt-2 text-center">
                <span className="font-display text-2xl font-bold text-[#FDF3E7]">{activeClass.name}</span>
                {activeClass.teacherName && <span className="text-xs text-[#F3E2CE]">{activeClass.teacherName} 선생님</span>}
              </div>
            </div>
          )}

          {/* 울타리 우리 */}
          <div className="relative z-[2] mt-3 rounded-2xl bg-[#A7C58C] px-3 py-5">
            <div className="pointer-events-none absolute rounded-[20px] border-[5px] border-[#8f5c44]" style={{ inset: "-4px", filter: "url(#rough)" }} />
            <div className="relative z-[1] grid grid-cols-4 gap-x-2 gap-y-4">
              {(() => {
                const classActive = shown.some((s) => Boolean(records[s.id]));
                return shown.map((s) => {
                  const d = displayStatus(records[s.id], classActive);
                  const absent = d === "unconfirmed" || d === "absent_with_reason";
                  return (
                  <div key={s.id} className="flex flex-col items-center gap-1">
                    <div className="relative">
                      <button
                        onClick={() => onTap(s.id)}
                        disabled={!canEdit}
                        className={`relative z-[1] flex h-14 w-14 items-center justify-center border-2 text-center text-[12.5px] font-bold leading-tight shadow-sm ${sheepCls(d)}`}
                        style={{ borderRadius: "52% 48% 50% 50% / 56% 56% 44% 44%" }}
                      >
                        {s.name}
                      </button>
                      {/* 양 다리 두 개 */}
                      <span aria-hidden className="pointer-events-none absolute inset-x-0 -bottom-1 flex justify-center gap-2.5">
                        <span className="block h-2 w-[3px] rounded-b-full bg-[#6b4a34]" />
                        <span className="block h-2 w-[3px] rounded-b-full bg-[#6b4a34]" />
                      </span>
                    </div>
                    {absent && (
                      <input
                        defaultValue={records[s.id]?.reason ?? ""}
                        onBlur={(e) => onReason(s.id, e.target.value)}
                        placeholder="사유"
                        disabled={!canEdit}
                        className="w-16 rounded-btn border border-border bg-white px-1 py-0.5 text-[10px] text-ink"
                      />
                    )}
                  </div>
                  );
                });
              })()}
              {shown.length === 0 && <p className="col-span-4 py-4 text-center text-sm text-ink">이 반에 학생이 없어요.</p>}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
