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
import { Icon } from "@/components/icon";
import {
  setAttendance,
  clearAttendance,
  closeSession,
  reopenSession,
  deleteDraftSession,
} from "@/app/actions/attendance";

function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}

type RecMap = Record<string, BoardRecord>;

export function AttendanceBoard({
  groupName,
  date,
  note,
  canEdit,
  isMaster,
  initialClosed,
  classes,
  students,
  initialRecords,
}: {
  groupName: string;
  date: string;
  note: string;
  canEdit: boolean;
  isMaster: boolean;
  initialClosed: boolean;
  classes: BoardClass[];
  students: BoardStudent[];
  initialRecords: RecMap;
}) {
  const [records, setRecords] = useState<RecMap>(initialRecords);
  const [closed, setClosed] = useState(initialClosed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const editable = canEdit && !closed;

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
    if (!editable) return;
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
    if (!editable) return;
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

  const hasAnyRecord = Object.keys(records).length > 0;

  async function onCloseSession() {
    const unchecked = students.filter((s) => !records[s.id]).length;
    const msg =
      unchecked > 0
        ? `아직 체크하지 않은 학생이 ${unchecked}명 있어요.\n마감하면 기록이 잠기고 통계·엑셀에 반영돼요. 마감할까요?`
        : "마감하면 기록이 잠기고 통계·엑셀에 반영돼요. 마감할까요?";
    if (!window.confirm(msg)) return;
    setBusy(true);
    setError(undefined);
    const r = await closeSession({ dateISO: date });
    setBusy(false);
    if (r?.error) setError(r.error);
    else setClosed(true);
  }

  async function onReopenSession() {
    setBusy(true);
    setError(undefined);
    const r = await reopenSession({ dateISO: date });
    setBusy(false);
    if (r?.error) setError(r.error);
    else setClosed(false);
  }

  async function onDeleteAll() {
    if (!window.confirm(`${date}에 기록한 모든 반의 출석을 전부 삭제할까요?\n삭제하면 되돌릴 수 없어요.`)) return;
    setBusy(true);
    setError(undefined);
    const r = await deleteDraftSession({ dateISO: date });
    setBusy(false);
    if (r?.error) setError(r.error);
    else setRecords({});
  }

  // 상태색 (디자인 기본 팔레트): 미체크=Lavender · 출석=Sage · 사유결석=Wheat · 연락필요=Blush
  const sheepCls = (d: DisplayStatus) =>
    d === "present" ? "bg-sage text-white"
    : d === "absent_with_reason" ? "bg-gold text-ink"
    : d === "unconfirmed" ? "bg-blush text-blush-deep"
    : "bg-lavender-soft text-ink ring-2 ring-inset ring-lavender"; // unchecked

  return (
    // Warm Cream 바탕 + 하단 파스텔 언덕 풍경(탭바 위 고정) — pb는 고정된 언덕 높이만큼 확보
    <main className="min-h-screen bg-bg pb-36">
      <div className="mx-auto w-full max-w-md">
        {/* 조직 이름 — 로그인 후 첫 화면에서 어느 조직인지 바로 보이게 */}
        <div className="px-5 pt-4 font-display text-lg font-bold text-sage-deep">
          {groupName}
        </div>
        {/* 상단 날짜/세션 */}
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <a href={`/attendance?date=${shiftDate(date, -1)}`} className="text-lg text-sky-deep">◀</a>
            <span className="text-lg font-bold tabular-nums text-ink">{date}</span>
            <a href={`/attendance?date=${shiftDate(date, 1)}`} className="text-lg text-sky-deep">▶</a>
          </div>
          <span className="flex items-center gap-1.5">
            {closed && (
              <span className="rounded-full bg-sage-deep px-3 py-1 text-sm font-bold text-white">마감됨</span>
            )}
            <span className="flex items-center gap-1.5 rounded-full border border-border bg-white px-3.5 py-1.5 text-sm font-medium text-ink shadow-sm">
              <span className="text-sky-deep">✝</span> {note}
            </span>
          </span>
        </div>

        {/* 반 탭 */}
        <div className="flex gap-2 overflow-x-auto px-5 pb-2">
          {tabs.map((t) => (
            <button
              key={t.id ?? "none"}
              onClick={() => setActiveTab(t.id)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm shadow-sm ${
                (t.id ?? null) === (activeTab ?? null)
                  ? "bg-sage font-bold text-white"
                  : "border border-border bg-white text-ink-muted"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>

        {/* 범례 (최소 폰트 크기 예외: 12px 유지) */}
        <div className="flex flex-wrap justify-center gap-3 px-5 py-2 text-xs text-ink-muted">
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-lavender align-middle" />미체크</span>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-sage align-middle" />출석</span>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-gold align-middle" />사유결석</span>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-blush align-middle" />연락필요</span>
        </div>

        {error && <p className="mx-5 rounded-btn bg-white px-3 py-1 text-sm text-danger">{error}</p>}

        {/* 목장 씬 */}
        <div className="relative px-3 pb-6 pt-3">
          {/* 반 팻말: Sage + 흰 점선 테두리 + 양 얼굴 */}
          {activeClass && (
            <div className="relative z-10 mx-auto w-60 rounded-2xl bg-sage px-3 pb-3 pt-2.5 shadow-md">
              <div className="pointer-events-none absolute inset-[5px] rounded-xl border-[1.5px] border-dashed border-white/75" />
              <div className="absolute -left-4 -top-4">
                <Icon name="sheep-face" size={40} alt="" />
              </div>
              <div className="flex items-baseline justify-center gap-2 text-center">
                <span className="font-display text-2xl font-bold text-white">{activeClass.name}</span>
                {activeClass.teacherName && <span className="text-sm text-white/90">{activeClass.teacherName} 선생님</span>}
              </div>
            </div>
          )}

          {/* 우리(pen): Ivory 카드 + 연세이지 테두리 */}
          <div className="relative z-[2] mt-3 rounded-3xl border-2 border-[#CBDCC6] bg-ivory px-3 py-5 shadow-sm">
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
                      disabled={!editable}
                      className={`flex h-14 w-14 items-center justify-center rounded-full text-center text-[14px] font-bold leading-tight ${sheepCls(d)}`}
                    >
                      {s.name}
                    </button>
                    {absent && (
                      <input
                        defaultValue={records[s.id]?.reason ?? ""}
                        onBlur={(e) => onReason(s.id, e.target.value)}
                        placeholder="사유"
                        disabled={!editable}
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

          {/* 마감 액션 — 임시(미마감) 기록이 있으면 마감하기/전체 삭제, 마감 후엔 해제(마스터). */}
          {canEdit && (
            <div className="mt-4 space-y-2 px-2 text-center">
              {closed ? (
                <>
                  <p className="text-sm text-ink-muted">
                    마감된 출석이에요. 통계와 엑셀에 반영됐어요.
                    {!isMaster && " 수정하려면 마스터에게 마감 해제를 요청하세요."}
                  </p>
                  {isMaster && (
                    <button
                      onClick={onReopenSession}
                      disabled={busy}
                      className="rounded-btn border border-border bg-white px-4 py-2 text-sm font-medium text-ink shadow-sm disabled:opacity-50"
                    >
                      마감 해제
                    </button>
                  )}
                </>
              ) : hasAnyRecord ? (
                <>
                  <button
                    onClick={onCloseSession}
                    disabled={busy}
                    className="w-full rounded-2xl bg-sage-deep px-4 py-3.5 text-[17px] font-bold tracking-wide text-ivory shadow-md disabled:opacity-50"
                  >
                    출석 마감하기
                  </button>
                  <p className="text-sm text-ink-muted">마감해야 통계와 엑셀에 반영돼요.</p>
                  <button
                    onClick={onDeleteAll}
                    disabled={busy}
                    className="text-sm text-sky-deep underline underline-offset-4 disabled:opacity-50"
                  >
                    이 날 모든 반 기록 삭제
                  </button>
                </>
              ) : (
                <p className="text-sm text-ink-muted">학생을 탭해 출석을 시작하세요. 다 체크한 뒤 마감하면 통계에 반영돼요.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 하단 풍경: 라벤더 산 → 더스티블루 능선 → 세이지 초원 (장식).
          탭바(높이 약 75px, z-50) 바로 위에 항상 고정 — 세이지 초원 띠까지 다 보이도록
          겹침은 최소(~3px)로만. (56px였을 땐 초록이 탭바에 거의 가려짐 — 사라 피드백) */}
      <svg
        viewBox="0 0 420 132"
        preserveAspectRatio="none"
        className="pointer-events-none fixed inset-x-0 bottom-[72px] z-40 h-28 w-full"
        aria-hidden="true"
      >
        <ellipse cx="90" cy="166" rx="190" ry="96" fill="#B9B3D8" opacity=".55" />
        <ellipse cx="330" cy="174" rx="210" ry="104" fill="#B9B3D8" opacity=".75" />
        <ellipse cx="60" cy="176" rx="230" ry="96" fill="#7E9CA2" opacity=".7" />
        <ellipse cx="340" cy="184" rx="240" ry="98" fill="#7E9CA2" opacity=".55" />
        <ellipse cx="120" cy="200" rx="280" ry="104" fill="#A8C5A1" />
        <ellipse cx="360" cy="208" rx="260" ry="100" fill="#A8C5A1" />
        <g fill="#F3C86B">
          <circle cx="40" cy="122" r="2" /><circle cx="150" cy="118" r="2" />
          <circle cx="260" cy="126" r="2" /><circle cx="390" cy="120" r="2" />
        </g>
        <g fill="#F6C7CF">
          <circle cx="105" cy="126" r="2" /><circle cx="300" cy="128" r="2" /><circle cx="365" cy="112" r="2" />
        </g>
      </svg>
    </main>
  );
}
