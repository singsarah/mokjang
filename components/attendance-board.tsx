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
    d === "present" ? "bg-sage-deep text-white"
    : d === "absent_with_reason" ? "bg-gold text-ink"
    : d === "unconfirmed" ? "bg-danger text-white"
    : "bg-[#FBEEE6] text-ink"; // unchecked(흰)

  return (
    // 화면 전체가 푸른 풀밭 (크림색 바탕 없음)
    <main className="min-h-screen pb-24" style={{ background: "#85B287" }}>
      <div className="mx-auto max-w-md">
        {/* 상단 날짜/세션 */}
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <a href={`/attendance?date=${shiftDate(date, -1)}`} className="text-lg text-[#F3E2CE]">◀</a>
            <span className="font-bold text-[#FDF3E7]">{date}</span>
            <a href={`/attendance?date=${shiftDate(date, 1)}`} className="text-lg text-[#F3E2CE]">▶</a>
          </div>
          <span className="rounded-tag bg-gold-soft px-3 py-1 text-sm text-ink-muted">{note}</span>
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

        {/* 범례 (최소 폰트 크기 예외: 12px 유지) */}
        <div className="flex flex-wrap justify-center gap-3 px-5 pb-2 text-xs text-[#FDF3E7]">
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
            <div className="relative z-10 mx-auto w-52 rounded-xl bg-[#8d6549] px-2 pb-2.5 pt-2">
              <div className="flex items-baseline justify-center gap-2 text-center">
                <span className="font-display text-2xl font-bold text-[#FDF3E7]">{activeClass.name}</span>
                {activeClass.teacherName && <span className="text-sm text-[#F3E2CE]">{activeClass.teacherName} 선생님</span>}
              </div>
            </div>
          )}

          {/* 울타리 우리 */}
          <div className="relative z-[2] mt-3 rounded-2xl border-[5px] border-[#8f5c44] bg-[#A7C58C] px-3 py-5">
            <div className="relative z-[1] grid grid-cols-4 gap-x-2 gap-y-4">
              {(() => {
                const classActive = shown.some((s) => Boolean(records[s.id]));
                return shown.map((s) => {
                  const d = displayStatus(records[s.id], classActive);
                  const absent = d === "unconfirmed" || d === "absent_with_reason";
                  return (
                  <div key={s.id} className="flex flex-col items-center gap-1">
                    <button
                      onClick={() => onTap(s.id)}
                      disabled={!canEdit}
                      className={`flex h-14 w-14 items-center justify-center rounded-full text-center text-[14px] font-bold leading-tight ${sheepCls(d)}`}
                    >
                      {s.name}
                    </button>
                    {absent && (
                      <input
                        defaultValue={records[s.id]?.reason ?? ""}
                        onBlur={(e) => onReason(s.id, e.target.value)}
                        placeholder="사유"
                        disabled={!canEdit}
                        className="-mt-1 w-full rounded-btn border border-border bg-white px-1.5 py-1 text-center text-[14px] text-ink"
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
