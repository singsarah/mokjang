"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createEvent, updateEvent, deleteEvent } from "@/app/actions/events";
import { createAbsence, updateAbsence, deleteAbsence } from "@/app/actions/absences";
import { eventSchema, type EventInput, type EventParsed } from "@/lib/validation/event";
import {
  absenceSchema,
  type AbsenceInput,
  type AbsenceParsed,
} from "@/lib/validation/absence";
import { Icon } from "@/components/icon";

export type CalendarEventItem = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM
  description: string | null;
};

export type AbsenceItem = {
  id: string;
  teacherId: string;
  teacherName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason: string | null;
};

export type BirthdayItem = {
  id: string; // students.id 또는 teachers.id — 상세 페이지 이동용
  name: string;
  day: number;
  who: "student" | "teacher";
  // 학생 전용 (교사는 전부 null)
  gender: string | null;
  grade: number | null;
  className: string | null;
  photoUrl: string | null; // 서명 URL (서버에서 생성)
};

const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

function weekdayOf(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return WEEKDAYS_KO[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// 출타 기간 라벨: "7/14~7/18"
function rangeLabel(start: string, end: string): string {
  const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
  return `${md(start)}~${md(end)}`;
}

// 성별 점 색 (class-detail/dashboard 패턴과 동일)
const genderDot = (gender: string | null) =>
  gender === "female"
    ? "bg-pink-400"
    : gender === "male"
      ? "bg-sky-400"
      : "bg-transparent border border-border";

// 학년·반 라벨 (dashboard 패턴과 동일: "2학년 · 1반")
function gradeLabel(grade: number | null, className: string | null): string {
  if (grade == null) return "";
  return className ? `${grade}학년 · ${className}` : `${grade}학년`;
}

// 학생 사진 동그라미 (학적부 폼과 동일: 사진 없으면 양 아이콘)
function StudentAvatar({ photoUrl, size }: { photoUrl: string | null; size: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-card"
      style={{ width: size, height: size }}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <Icon name="sheep-face" size={Math.round(size * 0.65)} alt="" />
      )}
    </span>
  );
}

// 생일 행 본문 (목록/팝업 공용): 사진 + 성별 점 + 🎂 이름 + 학년·반
function BirthdayBody({ b }: { b: BirthdayItem }) {
  if (b.who === "teacher") {
    return (
      <span className="text-sm text-ink">
        🎂 {b.name} <span className="text-sm text-ink-muted">(교사)</span>
      </span>
    );
  }
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <StudentAvatar photoUrl={b.photoUrl} size={32} />
      <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${genderDot(b.gender)}`} />
      <span className="truncate text-sm text-ink">
        🎂 {b.name} <span className="text-sm text-ink-muted">(학생)</span>
      </span>
      {gradeLabel(b.grade, b.className) && (
        <span className="ml-auto shrink-0 text-sm text-ink-muted">
          {gradeLabel(b.grade, b.className)}
        </span>
      )}
    </span>
  );
}

// ── 일정 추가/수정 모달 ──────────────────────────────────────────

function EventFormModal({
  event,
  defaultDate,
  onClose,
}: {
  event: CalendarEventItem | null; // null = 새 일정
  defaultDate: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EventInput, unknown, EventParsed>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: event?.title ?? "",
      date: event?.date ?? defaultDate,
      time: event?.time ?? "",
      description: event?.description ?? "",
    },
  });

  const onSubmit = handleSubmit((data) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = event
        ? await updateEvent({ id: event.id, ...data })
        : await createEvent(data);
      if (result?.error) {
        setServerError(result.error);
        return;
      }
      onClose();
      router.refresh();
    });
  });

  function onDelete() {
    if (!event) return;
    if (!window.confirm("이 일정을 삭제할까요?")) return;
    setServerError(undefined);
    startTransition(async () => {
      const result = await deleteEvent({ id: event.id });
      if (result?.error) {
        setServerError(result.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  const input =
    "mt-1 w-full rounded-btn border border-border bg-white px-3 py-2 text-ink";
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-lg">
        <h2 className="font-display text-lg font-bold text-ink">
          {event ? "일정 수정" : "일정 추가"}
        </h2>
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <label className="block">
            <span className="text-sm text-ink-muted">날짜 *</span>
            <input type="date" {...register("date")} className={input} />
            {errors.date && (
              <p className="mt-1 text-sm text-danger">{errors.date.message}</p>
            )}
          </label>
          <label className="block">
            <span className="text-sm text-ink-muted">시간 (선택)</span>
            <input type="time" {...register("time")} className={input} />
            {errors.time && (
              <p className="mt-1 text-sm text-danger">{errors.time.message}</p>
            )}
          </label>
          <label className="block">
            <span className="text-sm text-ink-muted">제목 *</span>
            <input
              {...register("title")}
              placeholder="예: 여름 수련회"
              className={input}
            />
            {errors.title && (
              <p className="mt-1 text-sm text-danger">{errors.title.message}</p>
            )}
          </label>
          <label className="block">
            <span className="text-sm text-ink-muted">설명 (선택)</span>
            <textarea
              {...register("description")}
              rows={3}
              placeholder="메모를 자유롭게 적으세요"
              className={input}
            />
            {errors.description && (
              <p className="mt-1 text-sm text-danger">{errors.description.message}</p>
            )}
          </label>

          {serverError && <p className="text-sm text-danger">{serverError}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="flex-1 rounded-btn border border-border py-2.5 text-sm text-ink-muted transition hover:bg-card disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-btn bg-sage py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-sage-deep disabled:opacity-50"
            >
              {isPending ? "저장 중..." : "저장"}
            </button>
          </div>
          {event && (
            <button
              type="button"
              onClick={onDelete}
              disabled={isPending}
              className="w-full rounded-btn border border-danger py-2 text-sm text-danger transition hover:bg-unconfirmed-soft disabled:opacity-50"
            >
              이 일정 삭제
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

// ── 출타 추가/수정 모달 ──────────────────────────────────────────

function AbsenceFormModal({
  absence,
  defaultDate,
  teacherOptions,
  myTeacherId,
  isMaster,
  onClose,
}: {
  absence: AbsenceItem | null; // null = 새 출타
  defaultDate: string;
  teacherOptions: { id: string; name: string }[];
  myTeacherId: string | null;
  isMaster: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const fixedTeacherId = absence?.teacherId ?? myTeacherId;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AbsenceInput, unknown, AbsenceParsed>({
    resolver: zodResolver(absenceSchema),
    defaultValues: {
      teacherId: fixedTeacherId ?? teacherOptions[0]?.id ?? "",
      startDate: absence?.startDate ?? defaultDate,
      endDate: absence?.endDate ?? defaultDate,
      reason: absence?.reason ?? "",
    },
  });

  const onSubmit = handleSubmit((data) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = absence
        ? await updateAbsence({ id: absence.id, ...data })
        : await createAbsence(data);
      if (result?.error) {
        setServerError(result.error);
        return;
      }
      onClose();
      router.refresh();
    });
  });

  function onDelete() {
    if (!absence) return;
    if (!window.confirm("이 출타를 삭제할까요?")) return;
    setServerError(undefined);
    startTransition(async () => {
      const result = await deleteAbsence({ id: absence.id });
      if (result?.error) {
        setServerError(result.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  const input =
    "mt-1 w-full rounded-btn border border-border bg-white px-3 py-2 text-ink";

  // 입력 불가 안내: 비마스터인데 내 계정이 명단에 연결돼 있지 않거나(새 출타),
  // 마스터인데 명단 자체가 비어 있는 경우.
  const guidance =
    !isMaster && fixedTeacherId === null
      ? "내 계정이 교사 명단에 아직 연결되지 않았어요. 대표 교사에게 설정 > 교사 관리에서 연결을 요청해주세요."
      : isMaster && !absence && teacherOptions.length === 0
        ? "교사 명단이 비어 있어요. 설정 > 교사 관리에서 교사를 먼저 추가해주세요."
        : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-lg">
        <h2 className="font-display text-lg font-bold text-ink">
          {absence ? "출타 수정" : "출타 등록"}
        </h2>
        {guidance ? (
          <>
            <p className="mt-3 text-sm text-ink-muted">{guidance}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full rounded-btn border border-border py-2.5 text-sm text-ink-muted transition hover:bg-card"
            >
              닫기
            </button>
          </>
        ) : (
          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            <label className="block">
              <span className="text-sm text-ink-muted">교사 *</span>
              {isMaster ? (
                <select {...register("teacherId")} className={input}>
                  {teacherOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <input type="hidden" {...register("teacherId")} />
                  <p className={`${input} bg-card`}>
                    {teacherOptions.find((t) => t.id === fixedTeacherId)?.name ??
                      "?"}
                  </p>
                </>
              )}
              {errors.teacherId && (
                <p className="mt-1 text-sm text-danger">
                  {errors.teacherId.message}
                </p>
              )}
            </label>
            <div className="flex gap-2">
              <label className="block flex-1">
                <span className="text-sm text-ink-muted">시작일 *</span>
                <input type="date" {...register("startDate")} className={input} />
              </label>
              <label className="block flex-1">
                <span className="text-sm text-ink-muted">종료일 *</span>
                <input type="date" {...register("endDate")} className={input} />
              </label>
            </div>
            {(errors.startDate || errors.endDate) && (
              <p className="text-sm text-danger">
                {errors.startDate?.message ?? errors.endDate?.message}
              </p>
            )}
            <label className="block">
              <span className="text-sm text-ink-muted">사유 (선택)</span>
              <input
                {...register("reason")}
                placeholder="예: 출장, 가족 여행"
                className={input}
              />
              {errors.reason && (
                <p className="mt-1 text-sm text-danger">{errors.reason.message}</p>
              )}
            </label>

            {serverError && <p className="text-sm text-danger">{serverError}</p>}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="flex-1 rounded-btn border border-border py-2.5 text-sm text-ink-muted transition hover:bg-card disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 rounded-btn bg-gold-deep py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
              >
                {isPending ? "저장 중..." : "저장"}
              </button>
            </div>
            {absence && (
              <button
                type="button"
                onClick={onDelete}
                disabled={isPending}
                className="w-full rounded-btn border border-danger py-2 text-sm text-danger transition hover:bg-unconfirmed-soft disabled:opacity-50"
              >
                이 출타 삭제
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

// ── 그리드 + 플로팅 팝업 + 이번 달 목록 ──────────────────────────

type ListEntry =
  | { kind: "event"; day: number; event: CalendarEventItem }
  | { kind: "absence"; day: number; a: AbsenceItem }
  | { kind: "birthday"; day: number; b: BirthdayItem };

// 같은 날 정렬: 일정 → 출타 → 생일
const KIND_ORDER: Record<ListEntry["kind"], number> = {
  event: 0,
  absence: 1,
  birthday: 2,
};

type DayMarker = { type: "event" | "absence" | "birthday"; label: string };

type ModalState =
  | null
  | { kind: "create"; date: string }
  | { kind: "edit"; event: CalendarEventItem }
  | { kind: "absence-create"; date: string }
  | { kind: "absence-edit"; absence: AbsenceItem };

export function CalendarMonthView({
  month, // YYYY-MM
  todayDay, // 이번 달을 보고 있을 때 오늘 날짜(일), 아니면 null
  defaultDate, // 새 일정 기본 날짜
  events,
  birthdays,
  absences,
  teacherOptions,
  myTeacherId,
  canEdit,
  isMaster,
}: {
  month: string;
  todayDay: number | null;
  defaultDate: string;
  events: CalendarEventItem[];
  birthdays: BirthdayItem[];
  absences: AbsenceItem[];
  teacherOptions: { id: string; name: string }[];
  myTeacherId: string | null;
  canEdit: boolean;
  isMaster: boolean;
}) {
  // 날짜 선택: 팝업 표시 + 목록 상단 고정 + 셀 강조. 같은 날짜 다시 탭 → 해제.
  // 팝업만 닫으면(X/바깥 탭) 선택은 유지되어 목록 상단 고정이 남는다.
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);

  const [year, monthNum] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(year, monthNum - 1, 1)).getUTCDay();

  // 출타 기간을 이번 달 범위로 클램프한 [시작일, 종료일] (일 단위 숫자).
  function absenceDaySpan(a: AbsenceItem): [number, number] {
    const from =
      a.startDate < `${month}-01` ? 1 : Number(a.startDate.slice(8, 10));
    const to =
      a.endDate > `${month}-${pad(lastDay)}`
        ? lastDay
        : Number(a.endDate.slice(8, 10));
    return [from, to];
  }
  function absenceCovers(a: AbsenceItem, day: number): boolean {
    const [from, to] = absenceDaySpan(a);
    return from <= day && day <= to;
  }

  // ── 목록 엔트리 (시간순) ──
  // 출타는 기간당 1행 — 시작일(월 이전이면 1일)에 앵커.
  const entries: ListEntry[] = [
    ...events.map((e) => ({
      kind: "event" as const,
      day: Number(e.date.slice(8, 10)),
      event: e,
    })),
    ...absences.map((a) => ({
      kind: "absence" as const,
      day: absenceDaySpan(a)[0],
      a,
    })),
    ...birthdays.map((b) => ({ kind: "birthday" as const, day: b.day, b })),
  ].sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    if (a.kind !== b.kind) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    if (a.kind === "event" && b.kind === "event")
      return (a.event.time ?? "99:99").localeCompare(b.event.time ?? "99:99");
    return 0;
  });

  // 선택한 날짜 항목: 일정·생일은 그 날짜, 출타는 기간이 그 날을 포함하면 표시.
  const selectedEntries: ListEntry[] =
    selectedDay === null
      ? []
      : entries
          .filter((e) =>
            e.kind === "absence"
              ? absenceCovers(e.a, selectedDay)
              : e.day === selectedDay,
          )
          .map((e) =>
            e.kind === "absence" ? { ...e, day: selectedDay } : e,
          );
  const restEntries =
    selectedDay === null
      ? entries
      : entries.filter((e) =>
          e.kind === "absence"
            ? !absenceCovers(e.a, selectedDay)
            : e.day !== selectedDay,
        );

  // 팝업용: 출타는 "출타중" 헤더 아래 이름만 나열 (사람마다 "출타" 반복 방지).
  const selectedEvents = selectedEntries.filter(
    (e): e is Extract<ListEntry, { kind: "event" }> => e.kind === "event",
  );
  const selectedAbsences = selectedEntries.filter(
    (e): e is Extract<ListEntry, { kind: "absence" }> => e.kind === "absence",
  );
  const selectedBirthdays = selectedEntries.filter(
    (e): e is Extract<ListEntry, { kind: "birthday" }> => e.kind === "birthday",
  );

  // ── 그리드 마커 (일정 칩 먼저, 출타·생일은 하루에 하나로 압축) ──
  const markersByDay = new Map<number, DayMarker[]>();
  for (const e of events) {
    const day = Number(e.date.slice(8, 10));
    if (!markersByDay.has(day)) markersByDay.set(day, []);
    markersByDay.get(day)!.push({ type: "event", label: e.title });
  }
  const absentNamesByDay = new Map<number, string[]>();
  for (const a of absences) {
    const [from, to] = absenceDaySpan(a);
    for (let day = from; day <= to; day++) {
      if (!absentNamesByDay.has(day)) absentNamesByDay.set(day, []);
      absentNamesByDay.get(day)!.push(a.teacherName);
    }
  }
  for (const [day, names] of absentNamesByDay) {
    if (!markersByDay.has(day)) markersByDay.set(day, []);
    markersByDay.get(day)!.push({
      type: "absence",
      label: names.length > 1 ? `${names[0]} 외 ${names.length - 1}` : names[0],
    });
  }
  const birthdayCountByDay = new Map<number, number>();
  for (const b of birthdays) {
    birthdayCountByDay.set(b.day, (birthdayCountByDay.get(b.day) ?? 0) + 1);
  }
  for (const [day, count] of birthdayCountByDay) {
    if (!markersByDay.has(day)) markersByDay.set(day, []);
    markersByDay
      .get(day)!
      .push({ type: "birthday", label: count > 1 ? `🎂×${count}` : "🎂" });
  }

  // 주 단위 셀 (앞뒤 빈 칸 포함)
  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: lastDay }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function onCellClick(day: number) {
    if (selectedDay === day) {
      setSelectedDay(null);
      setPopupOpen(false);
    } else {
      setSelectedDay(day);
      setPopupOpen(true);
    }
  }

  function clearSelection() {
    setSelectedDay(null);
    setPopupOpen(false);
  }

  const selectedDate =
    selectedDay === null ? null : `${month}-${pad(selectedDay)}`;
  const selectedLabel =
    selectedDay === null || selectedDate === null
      ? ""
      : `${monthNum}월 ${selectedDay}일 (${weekdayOf(selectedDate)})`;

  // 생일자 상세 페이지 링크 — 대상 페이지의 접근 규칙을 그대로 따른다:
  // 학적부 상세(/settings/roster/[id])는 master·editor, 교사 상세는 master 전용.
  // 권한이 없으면 null → 링크 대신 일반 행으로 표시.
  function birthdayHref(b: BirthdayItem): string | null {
    if (b.who === "student") return canEdit ? `/settings/roster/${b.id}` : null;
    return isMaster ? `/settings/teachers/roster/${b.id}` : null;
  }

  // ── 목록 행 렌더러 (고정 섹션/나머지 공용) ──
  function renderEntry(entry: ListEntry, i: number) {
    const dateStr = `${month}-${pad(entry.day)}`;
    const dayLabel = `${entry.day}일 (${weekdayOf(dateStr)})`;
    if (entry.kind === "birthday") {
      const href = birthdayHref(entry.b);
      const inner = (
        <>
          <span className="w-16 shrink-0 text-sm text-ink-muted">{dayLabel}</span>
          <BirthdayBody b={entry.b} />
        </>
      );
      return (
        <li key={`b-${entry.day}-${i}`}>
          {href ? (
            <Link
              href={href}
              className="flex w-full items-center gap-3 rounded-card border border-border/60 bg-white p-3 shadow-sm transition hover:shadow-md"
            >
              {inner}
              <span className="shrink-0 text-lg text-ink-muted">›</span>
            </Link>
          ) : (
            <div className="flex items-center gap-3 rounded-card border border-border/60 bg-white p-3 shadow-sm">
              {inner}
            </div>
          )}
        </li>
      );
    }
    if (entry.kind === "absence") {
      const a = entry.a;
      const canEditAbsence = isMaster || a.teacherId === myTeacherId;
      const inner = (
        <>
          <span className="w-16 shrink-0 text-sm text-ink-muted">{dayLabel}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">
              ✈️ {a.teacherName}
              {a.startDate !== a.endDate && (
                <span className="ml-1.5 text-sm font-normal text-gold-deep">
                  {rangeLabel(a.startDate, a.endDate)}
                </span>
              )}
            </span>
            {a.reason && (
              <span className="block truncate text-sm text-ink-muted">
                {a.reason}
              </span>
            )}
          </span>
        </>
      );
      return (
        <li key={a.id}>
          {canEditAbsence ? (
            <button
              onClick={() => setModal({ kind: "absence-edit", absence: a })}
              className="flex w-full items-center gap-3 rounded-card border border-border/60 bg-white p-3 text-left shadow-sm transition hover:shadow-md"
            >
              {inner}
              <span className="shrink-0 text-lg text-ink-muted">›</span>
            </button>
          ) : (
            <div className="flex items-center gap-3 rounded-card border border-border/60 bg-white p-3 shadow-sm">
              {inner}
            </div>
          )}
        </li>
      );
    }
    const e = entry.event;
    const body = (
      <>
        <span className="w-16 shrink-0 text-sm text-ink-muted">{dayLabel}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">
            {e.time && (
              <span className="mr-1.5 text-sm font-normal text-sage-deep">
                {e.time}
              </span>
            )}
            {e.title}
          </span>
          {e.description && (
            <span className="block truncate text-sm text-ink-muted">
              {e.description}
            </span>
          )}
        </span>
      </>
    );
    return (
      <li key={e.id}>
        {canEdit ? (
          <button
            onClick={() => setModal({ kind: "edit", event: e })}
            className="flex w-full items-center gap-3 rounded-card border border-border/60 bg-white p-3 text-left shadow-sm transition hover:shadow-md"
          >
            {body}
            <span className="shrink-0 text-lg text-ink-muted">›</span>
          </button>
        ) : (
          <div className="flex items-center gap-3 rounded-card border border-border/60 bg-white p-3 shadow-sm">
            {body}
          </div>
        )}
      </li>
    );
  }

  return (
    <>
      {/* 달력 그리드 */}
      <div className="mt-4 overflow-hidden rounded-card border border-border/60 bg-white shadow-sm">
        {/* 주일에 일정이 몰리므로 일요일 칸만 3배 폭 (헤더·본문 동일 템플릿).
            minmax(0,·)로 긴 일정 제목이 칸을 억지로 늘리지 못하게 고정. */}
        <div className="grid grid-cols-[minmax(0,3fr)_repeat(6,minmax(0,1fr))] border-b border-border/60">
          {WEEKDAYS_KO.map((w, i) => (
            <div
              key={w}
              className={`py-1.5 text-center text-sm font-medium ${
                i === 0
                  ? "text-danger"
                  : i === 6
                    ? "text-sage-deep"
                    : "text-ink-muted"
              }`}
            >
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[minmax(0,3fr)_repeat(6,minmax(0,1fr))]">
          {cells.map((day, i) => {
            const rightEdge = i % 7 === 6;
            const isSunday = i % 7 === 0;
            const cellBorder = `min-h-16 border-b border-border/30 p-0.5 ${
              rightEdge ? "" : "border-r"
            }`;
            if (day === null) {
              return <div key={`empty-${i}`} className={cellBorder} />;
            }
            const markers = markersByDay.get(day) ?? [];
            // 넓은 일요일 칸은 마커 3개까지, 좁은 평일 칸은 1개(생일 정도)만.
            const shown = markers.slice(0, isSunday ? 3 : 1);
            const overflow = markers.length - shown.length;
            const isToday = day === todayDay;
            const isSelected = day === selectedDay;
            return (
              <button
                key={day}
                type="button"
                onClick={() => onCellClick(day)}
                aria-label={`${monthNum}월 ${day}일 선택`}
                // 버튼 기본 세로 가운데 정렬을 끄고 숫자를 항상 칸 맨 위에 고정
                className={`${cellBorder} flex w-full flex-col justify-start text-left transition ${
                  isSelected
                    ? "bg-sage-soft ring-1 ring-inset ring-sage"
                    : "hover:bg-card"
                }`}
              >
                <div
                  className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-sm leading-none ${
                    isToday
                      ? "bg-sage-deep font-bold text-white"
                      : i % 7 === 0
                        ? "text-danger"
                        : "text-ink"
                  }`}
                >
                  {day}
                </div>
                <div className="mt-0.5 space-y-0.5">
                  {shown.map((mk, j) =>
                    mk.type === "event" ? (
                      <div
                        key={j}
                        className="truncate rounded-sm bg-sage px-0.5 text-sm leading-none text-white"
                      >
                        {mk.label}
                      </div>
                    ) : mk.type === "absence" ? (
                      <div
                        key={j}
                        className="truncate rounded-sm bg-gold-soft px-0.5 text-sm leading-none text-gold-deep"
                      >
                        {mk.label}
                      </div>
                    ) : (
                      <div
                        key={j}
                        className="truncate text-center text-sm leading-none"
                      >
                        {mk.label}
                      </div>
                    ),
                  )}
                  {overflow > 0 && (
                    <div className="text-center text-sm leading-none text-ink-muted">
                      +{overflow}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 선택한 날짜 플로팅 팝업 */}
      {popupOpen && selectedDay !== null && selectedDate !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          onClick={() => setPopupOpen(false)}
        >
          <div className="absolute inset-0 bg-black/30" />
          <div
            role="dialog"
            aria-label="선택한 날짜 일정"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-card bg-white p-5 shadow-lg"
          >
            <div className="flex items-start justify-between">
              <h2 className="font-display text-lg font-bold text-ink">
                {selectedLabel}
              </h2>
              <button
                type="button"
                aria-label="닫기"
                onClick={() => setPopupOpen(false)}
                className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition hover:bg-card hover:text-ink"
              >
                ✕
              </button>
            </div>
            {selectedEntries.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">일정 없음</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {selectedEvents.map((entry) => (
                  <li key={entry.event.id} className="text-sm">
                    <span className="font-medium text-ink">
                      {entry.event.time && (
                        <span className="mr-1.5 text-sm font-normal text-sage-deep">
                          {entry.event.time}
                        </span>
                      )}
                      {entry.event.title}
                    </span>
                    {entry.event.description && (
                      <span className="mt-0.5 block text-sm text-ink-muted">
                        {entry.event.description}
                      </span>
                    )}
                  </li>
                ))}
                {selectedAbsences.length > 0 && (
                  <li className="text-sm">
                    <span className="font-medium text-ink">✈️ 출타중</span>
                    <ul className="mt-1 space-y-1">
                      {selectedAbsences.map((entry) => (
                        <li key={entry.a.id} className="pl-6 text-sm text-ink">
                          {entry.a.teacherName}
                          {entry.a.startDate !== entry.a.endDate && (
                            <span className="ml-1.5 text-gold-deep">
                              {rangeLabel(entry.a.startDate, entry.a.endDate)}
                            </span>
                          )}
                          {entry.a.reason && (
                            <span className="ml-1.5 text-ink-muted">
                              · {entry.a.reason}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </li>
                )}
                {selectedBirthdays.map((entry, i) => (
                  <li key={`pb-${i}`}>
                    {birthdayHref(entry.b) ? (
                      <Link
                        href={birthdayHref(entry.b)!}
                        className="-mx-1.5 flex items-center gap-1 rounded-btn px-1.5 py-1 transition hover:bg-card"
                      >
                        <BirthdayBody b={entry.b} />
                        <span className="shrink-0 text-base text-ink-muted">›</span>
                      </Link>
                    ) : (
                      <span className="flex items-center">
                        <BirthdayBody b={entry.b} />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  setPopupOpen(false);
                  setModal({ kind: "create", date: selectedDate });
                }}
                className="mt-4 w-full rounded-btn border border-sage py-2 text-sm font-medium text-sage-deep transition hover:bg-sage-soft"
              >
                + 이 날짜에 일정 추가
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setPopupOpen(false);
                setModal({ kind: "absence-create", date: selectedDate });
              }}
              className={`${canEdit ? "mt-2" : "mt-4"} w-full rounded-btn border border-gold-deep/40 py-2 text-sm font-medium text-gold-deep transition hover:bg-gold-soft/60`}
            >
              ✈️ 이 날짜에 출타 등록
            </button>
          </div>
        </div>
      )}

      {/* 버튼 + 이번 달 목록 */}
      <section className="mt-6">
        {canEdit && (
          <div className="flex gap-2">
            <button
              onClick={() => setModal({ kind: "create", date: defaultDate })}
              className="flex-1 rounded-btn bg-sage py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-sage-deep"
            >
              + 일정 추가
            </button>
            <Link
              href="/calendar/import"
              className="flex-1 rounded-btn border border-sage py-2.5 text-center text-sm font-medium text-sage-deep transition hover:bg-sage-soft"
            >
              일정표 가져오기
            </Link>
          </div>
        )}
        {/* 출타 등록은 viewer 포함 모든 활성 멤버에게 노출 — 본인 출타는 누구나 입력 가능 */}
        <button
          onClick={() => setModal({ kind: "absence-create", date: defaultDate })}
          className={`${canEdit ? "mt-2" : ""} w-full rounded-btn border border-gold-deep/40 py-2.5 text-sm font-medium text-gold-deep transition hover:bg-gold-soft/60`}
        >
          ✈️ 출타 등록
        </button>

        <h2 className="mt-6 text-sm font-bold text-ink-muted">이번 달 목록</h2>

        {/* 선택한 날짜 항목을 맨 위에 고정 */}
        {selectedDay !== null && (
          <div className="mt-3 rounded-card border border-sage bg-sage-soft/60 p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-sage-deep">
                {selectedLabel} 일정
              </h3>
              <button
                type="button"
                onClick={clearSelection}
                className="rounded-tag px-2 py-0.5 text-sm text-ink-muted transition hover:text-ink"
              >
                선택 해제 ✕
              </button>
            </div>
            {selectedEntries.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">일정 없음</p>
            ) : (
              <ul className="mt-2 space-y-2">{selectedEntries.map(renderEntry)}</ul>
            )}
          </div>
        )}

        {entries.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">
            이번 달에는 등록된 일정과 생일이 없어요.
          </p>
        ) : restEntries.length > 0 ? (
          <ul className="mt-3 space-y-2">{restEntries.map(renderEntry)}</ul>
        ) : null}
      </section>

      {(modal?.kind === "create" || modal?.kind === "edit") && (
        <EventFormModal
          event={modal.kind === "edit" ? modal.event : null}
          defaultDate={modal.kind === "create" ? modal.date : defaultDate}
          onClose={() => setModal(null)}
        />
      )}
      {(modal?.kind === "absence-create" || modal?.kind === "absence-edit") && (
        <AbsenceFormModal
          absence={modal.kind === "absence-edit" ? modal.absence : null}
          defaultDate={modal.kind === "absence-create" ? modal.date : defaultDate}
          teacherOptions={teacherOptions}
          myTeacherId={myTeacherId}
          isMaster={isMaster}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
