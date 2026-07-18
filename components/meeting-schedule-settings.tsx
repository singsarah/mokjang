"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WEEKDAY_LABELS_KO, weekdayOf } from "@/lib/meeting-schedule";
import {
  addExtraMeeting,
  removeExtraMeeting,
  updateMeetingDayName,
  updateMeetingDays,
} from "@/app/actions/meeting-schedule";

export type ExtraMeetingItem = { date: string; name: string | null };

// 조직 관리(마스터): 정기 모임 요일 토글(+요일별 모임 이름) + 임시 모임 날짜/이름 추가·삭제.
// 요일 토글은 누르는 즉시 저장(낙관적 UI, 실패 시 롤백), 모임 이름은 입력 칸을 벗어날 때 저장.
export function MeetingScheduleSettings({
  initialDays,
  initialDayNames,
  initialExtras,
}: {
  initialDays: number[];
  initialDayNames: Record<string, string>; // 키 = 요일("0"~"6")
  initialExtras: ExtraMeetingItem[]; // 정렬은 여기서
}) {
  const router = useRouter();
  const [days, setDays] = useState<number[]>(initialDays);
  const [dayNames, setDayNames] = useState<Record<string, string>>(initialDayNames);
  // 마지막으로 저장에 성공한 이름 — blur 때 바뀐 경우에만 서버 호출.
  const [savedNames, setSavedNames] = useState<Record<string, string>>(initialDayNames);
  const [extras, setExtras] = useState<ExtraMeetingItem[]>(
    [...initialExtras].sort((a, b) => a.date.localeCompare(b.date)),
  );
  const [newDate, setNewDate] = useState("");
  const [newName, setNewName] = useState("");
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

  async function saveDayName(day: number) {
    const key = String(day);
    const name = (dayNames[key] ?? "").trim();
    if (name === (savedNames[key] ?? "")) return; // 안 바뀌었으면 저장 안 함
    setError(undefined);
    setBusy(true);
    try {
      const r = await updateMeetingDayName({ day, name });
      if (r?.error) {
        setError(r.error);
      } else {
        setSavedNames((s) => ({ ...s, [key]: name }));
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function onAddExtra() {
    if (!newDate || busy) return;
    setError(undefined);
    setBusy(true);
    try {
      const r = await addExtraMeeting({ dateISO: newDate, name: newName });
      if (r?.error) {
        setError(r.error);
      } else {
        const item = { date: newDate, name: newName.trim() || null };
        setExtras((xs) =>
          [...xs.filter((x) => x.date !== newDate), item].sort((a, b) =>
            a.date.localeCompare(b.date),
          ),
        );
        setNewDate("");
        setNewName("");
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
        setExtras((xs) => xs.filter((x) => x.date !== date));
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
        {days.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-ink-muted">
              모임 이름을 적으면 출석 화면 위에 그 이름이 보여요. (비우면 일요일은
              &ldquo;주일예배&rdquo;, 다른 요일은 &ldquo;모임&rdquo;)
            </p>
            {days.map((day) => (
              <label key={day} className="flex items-center gap-2">
                <span className="w-14 shrink-0 text-sm text-ink">
                  {WEEKDAY_LABELS_KO[day]}요일
                </span>
                <input
                  type="text"
                  value={dayNames[String(day)] ?? ""}
                  onChange={(e) =>
                    setDayNames((s) => ({ ...s, [String(day)]: e.target.value }))
                  }
                  onBlur={() => saveDayName(day)}
                  placeholder={day === 0 ? "주일예배" : "모임"}
                  maxLength={50}
                  aria-label={`${WEEKDAY_LABELS_KO[day]}요일 모임 이름`}
                  className="min-w-0 flex-1 rounded-btn border border-border bg-white px-3 py-2 text-sm text-ink"
                />
              </label>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="text-sm text-ink-muted">임시 모임</div>
        <p className="mt-0.5 text-xs text-ink-muted">
          정기 요일 외에 모임이 있는 날을 추가하면 그날도 출석을 체크할 수 있어요.
          모임 이름은 출석 화면 위에 보여요.
        </p>
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
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
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="모임 이름 (예: 수련회, 성탄 예배)"
            maxLength={50}
            aria-label="임시 모임 이름"
            className="w-full rounded-btn border border-border bg-white px-3 py-2 text-sm text-ink"
          />
        </div>
        {extras.length > 0 && (
          <ul className="mt-3 space-y-2">
            {extras.map((x) => (
              <li
                key={x.date}
                className="flex items-center justify-between gap-2 rounded-btn border border-border bg-white px-3 py-2 text-sm"
              >
                <span className="min-w-0 text-ink">
                  <span className="tabular-nums">
                    {x.date} ({WEEKDAY_LABELS_KO[weekdayOf(x.date)]})
                  </span>
                  {x.name && <span className="text-ink-muted"> · {x.name}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveExtra(x.date)}
                  disabled={busy}
                  className="shrink-0 text-sm text-danger underline underline-offset-2 disabled:opacity-50"
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
