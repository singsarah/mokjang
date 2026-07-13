// 모임 일정 계산 — 순수 로직(클라이언트/서버 공용, DB 접근 없음).
// meeting_days 는 0=일요일 … 6=토요일 (JS Date.getDay 와 동일한 규약).

export const WEEKDAY_LABELS_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}

export function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// 서버(Vercel)는 UTC 로 돌기 때문에 new Date() 로컬 날짜를 쓰면 한국 아침에
// 어제 날짜가 나온다 — "오늘"은 항상 한국 시간 기준으로 계산.
export function todayISOSeoul(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// 정기 요일이나 임시 모임이 하나라도 설정돼 있는지 — false 면 출석 화면은
// 기존처럼 매일 단위로 이동한다(하위 호환).
export function hasSchedule(meetingDays: number[], extraDates: string[]): boolean {
  return meetingDays.length > 0 || extraDates.length > 0;
}

export function isMeetingDate(iso: string, meetingDays: number[], extraDates: string[]): boolean {
  return meetingDays.includes(weekdayOf(iso)) || extraDates.includes(iso);
}

// fromISO 이전의 가장 가까운 모임일. otherDates 에는 임시 모임 날짜와
// (모임일이 아니어도 접근 가능해야 하는) 기존 출석 기록 날짜를 함께 넘긴다.
export function prevMeetingDate(
  fromISO: string,
  meetingDays: number[],
  otherDates: string[],
): string | null {
  let best: string | null = null;
  if (meetingDays.length > 0) {
    for (let i = 1; i <= 7; i++) {
      const d = shiftDate(fromISO, -i);
      if (meetingDays.includes(weekdayOf(d))) {
        best = d;
        break;
      }
    }
  }
  for (const d of otherDates) {
    if (d < fromISO && (best === null || d > best)) best = d;
  }
  return best;
}

// fromISO 이후의 가장 가까운 모임일.
export function nextMeetingDate(
  fromISO: string,
  meetingDays: number[],
  otherDates: string[],
): string | null {
  let best: string | null = null;
  if (meetingDays.length > 0) {
    for (let i = 1; i <= 7; i++) {
      const d = shiftDate(fromISO, i);
      if (meetingDays.includes(weekdayOf(d))) {
        best = d;
        break;
      }
    }
  }
  for (const d of otherDates) {
    if (d > fromISO && (best === null || d < best)) best = d;
  }
  return best;
}

// 출석 화면 기본 날짜 = iso(보통 오늘) 이하의 가장 최근 모임일.
// 예) 모임 요일이 일요일이고 오늘이 7/13(월)이면 → 7/12(일).
export function latestMeetingOnOrBefore(
  iso: string,
  meetingDays: number[],
  otherDates: string[],
): string | null {
  if (isMeetingDate(iso, meetingDays, otherDates)) return iso;
  return prevMeetingDate(iso, meetingDays, otherDates);
}
