"use client";

import { useMemo, useState } from "react";
import {
  nextStatusOnTap,
  statusForReason,
  type AttStatus,
  type BoardClass,
  type BoardRecord,
  type BoardStudent,
} from "@/lib/attendance-cycle";
import { setAttendance, clearAttendance } from "@/app/actions/attendance";

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

  function statusOf(id: string): AttStatus | null {
    return records[id]?.status ?? null;
  }

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
    const next = nextStatusOnTap(statusOf(studentId));
    if (next === null) {
      const nr = { ...records };
      delete nr[studentId];
      void apply(studentId, nr, clearAttendance({ dateISO: date, studentId }));
    } else {
      const nr = { ...records, [studentId]: { status: next, reason: null } };
      void apply(studentId, nr, setAttendance({ dateISO: date, studentId, status: next, reason: null }));
    }
  }

  function onReason(studentId: string, reason: string) {
    if (!canEdit) return;
    const status = statusForReason(reason);
    const nr = { ...records, [studentId]: { status, reason: status === "absent_with_reason" ? reason : null } };
    void apply(studentId, nr, setAttendance({ dateISO: date, studentId, status, reason }));
  }

  const cardCls = (st: AttStatus | null) =>
    st === "present" ? "bg-sage-deep text-white border-sage-deep"
    : st === "absent_with_reason" ? "bg-gold border-gold-deep"
    : st === "unconfirmed" ? "bg-white border-2 border-danger"
    : "bg-white border-border";

  return (
    <main className="min-h-screen bg-sage-soft pb-24">
      <div className="mx-auto max-w-md px-5 py-6">
        <div className="flex items-center justify-between">
          <span className="font-bold text-ink">{date}</span>
          <span className="rounded-tag bg-gold-soft px-3 py-1 text-xs text-ink-muted">{note}</span>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
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

        {activeClass && (
          <h2 className="mt-4 font-display text-2xl font-bold text-ink">
            {activeClass.name}
            {activeClass.teacherName && (
              <span className="ml-2 text-sm font-normal text-ink-muted">{activeClass.teacherName} 선생님</span>
            )}
          </h2>
        )}

        {error && <p className="mt-2 text-sm text-danger">{error}</p>}

        <div className="mt-4 grid grid-cols-3 gap-3">
          {shown.map((s) => {
            const st = statusOf(s.id);
            const absent = st === "unconfirmed" || st === "absent_with_reason";
            return (
              <div key={s.id} className="flex flex-col items-center gap-1">
                <button
                  onClick={() => onTap(s.id)}
                  disabled={!canEdit}
                  className={`w-full rounded-card px-2 py-3 text-center text-sm font-bold ${cardCls(st)}`}
                >
                  {s.name}
                </button>
                {absent && (
                  <input
                    defaultValue={records[s.id]?.reason ?? ""}
                    onBlur={(e) => onReason(s.id, e.target.value)}
                    placeholder="사유(비우면 연락필요)"
                    disabled={!canEdit}
                    className="w-full rounded-btn border border-border px-2 py-1 text-xs text-ink"
                  />
                )}
              </div>
            );
          })}
          {shown.length === 0 && (
            <p className="col-span-3 mt-6 text-center text-ink-muted">이 반에 학생이 없어요.</p>
          )}
        </div>
      </div>
    </main>
  );
}
