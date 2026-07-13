"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WEEKDAY_LABELS_KO, weekdayOf } from "@/lib/meeting-schedule";
import {
  addExtraMeeting,
  removeExtraMeeting,
  updateMeetingDays,
} from "@/app/actions/meeting-schedule";

// 조직 관리(마스터): 정기 모임 요일 토글 + 임시 모임 날짜 추가/삭제.
// 요일 토글은 누르는 즉시 저장(낙관적 UI, 실패 시 롤백).
export function MeetingScheduleSettings({
  initialDays,
  initialExtras,
}: {
  initialDays: number[];
  initialExtras: string[]; // YYYY-MM-DD, 정렬은 여기서
}) {
  const router = useRouter();
  const [days, setDays] = useState<number[]>(initialDays);
  const [extras, setExtras] = useState<string[]>([...initialExtras].sort());
  const [newDate, setNewDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function toggleDay(day: number) {
    if (busy) return;
    const prev = days;
    const next = prev.includes(day)
      ? prev.filter((d) => d !== day)
      : [...prev, day].sort((a, b) => a - b);
    setDays(next);
    setError(undefined);
    setBusy(true);
    try {
      const r = await updateMeetingDays({ days: next });
      if (r?.error) {
        setDays(prev); // 롤백
        setError(r.error);
      } else {
        router.refresh();
      }
    } finally {
      setBusy(false); // 액션이 예외를 던져도 UI가 잠기지 않게
    }
  }

  async function onAddExtra() {
    if (!newDate || busy) return;
    setError(undefined);
    setBusy(true);
    try {
      const r = await addExtraMeeting({ dateISO: newDate });
      if (r?.error) {
        setError(r.error);
      } else {
        setExtras((xs) => [...new Set([...xs, newDate])].sort());
        setNewDate("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function onRemoveExtra(date: string) {
    if (busy) return;
    setError(undefined);
    setBusy(true);
    try {
      const r = await removeExtraMeeting({ dateISO: date });
      if (r?.error) {
        setError(r.error);
      } else {
        setExtras((xs) => xs.filter((x) => x !== date));
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-ink-muted">정기 모임 요일</div>
        <p className="mt-0.5 text-xs text-ink-muted">
          선택한 요일에만 출석 화면이 뜨고, 날짜 이동(◀▶)도 모임일 사이로만 움직여요.
        </p>
        <div className="mt-3 flex gap-1.5">
          {WEEKDAY_LABELS_KO.map((label, day) => {
            const on = days.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                disabled={busy}
                aria-pressed={on}
                className={`h-10 w-10 rounded-full text-sm font-bold shadow-sm transition disabled:opacity-60 ${
                  on
                    ? "bg-sage text-white"
                    : "border border-border bg-white text-ink-muted"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        {days.length === 0 && (
          <p className="mt-2 text-xs text-ink-muted">
            아직 요일을 선택하지 않아서 출석 화면이 매일 단위로 움직여요.
          </p>
        )}
      </div>

      <div>
        <div className="text-sm text-ink-muted">임시 모임</div>
        <p className="mt-0.5 text-xs text-ink-muted">
          정기 요일 외에 모임이 있는 날을 추가하면 그날도 출석을 체크할 수 있어요.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            aria-label="임시 모임 날짜"
            className="min-w-0 flex-1 rounded-btn border border-border bg-white px-3 py-2 text-sm text-ink"
          />
          <button
            type="button"
            onClick={onAddExtra}
            disabled={busy || !newDate}
            className="shrink-0 rounded-btn bg-sage-deep px-4 py-2 text-sm font-bold text-white shadow-sm disabled:opacity-50"
          >
            추가
          </button>
        </div>
        {extras.length > 0 && (
          <ul className="mt-3 space-y-2">
            {extras.map((d) => (
              <li
                key={d}
                className="flex items-center justify-between rounded-btn border border-border bg-white px-3 py-2 text-sm"
              >
                <span className="tabular-nums text-ink">
                  {d} ({WEEKDAY_LABELS_KO[weekdayOf(d)]})
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveExtra(d)}
                  disabled={busy}
                  className="text-sm text-danger underline underline-offset-2 disabled:opacity-50"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
