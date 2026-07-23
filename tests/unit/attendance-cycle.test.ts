import { describe, expect, it } from "vitest";
import { bucketSessionsByWeek, displayStatus, tapAction, reasonAction, trendWeekStarts } from "@/lib/attendance-cycle";

describe("displayStatus", () => {
  it("present 기록 → present", () =>
    expect(displayStatus({ status: "present", reason: null }, true)).toBe("present"));
  it("absent_with_reason 기록 → absent_with_reason", () =>
    expect(displayStatus({ status: "absent_with_reason", reason: "가족여행" }, true)).toBe("absent_with_reason"));
  it("기록 없음 + 반 active → unconfirmed", () =>
    expect(displayStatus(undefined, true)).toBe("unconfirmed"));
  it("기록 없음 + 반 not active → unchecked", () =>
    expect(displayStatus(undefined, false)).toBe("unchecked"));
  it("과거 unconfirmed 기록 + active → unconfirmed", () =>
    expect(displayStatus({ status: "unconfirmed", reason: null }, true)).toBe("unconfirmed"));
  it("과거 unconfirmed 기록 + not active → unchecked", () =>
    expect(displayStatus({ status: "unconfirmed", reason: null }, false)).toBe("unchecked"));
});

describe("tapAction", () => {
  it("present → clear(해제)", () =>
    expect(tapAction({ status: "present", reason: null })).toBe("clear"));
  it("기록 없음(미확인/미체크) → present", () =>
    expect(tapAction(undefined)).toBe("present"));
  it("absent_with_reason → present", () =>
    expect(tapAction({ status: "absent_with_reason", reason: "x" })).toBe("present"));
});

describe("reasonAction", () => {
  it("사유 있음 → reason", () =>
    expect(reasonAction("가족여행")).toEqual({ kind: "reason", reason: "가족여행" }));
  it("공백만 → clear", () => expect(reasonAction("   ")).toEqual({ kind: "clear" }));
  it("빈 문자열 → clear", () => expect(reasonAction("")).toEqual({ kind: "clear" }));
});

describe("trendWeekStarts", () => {
  it("일요일이면 그 날이 이번주 시작", () =>
    // 2026-07-19 = 일요일
    expect(trendWeekStarts("2026-07-19")).toEqual(["2026-06-28", "2026-07-05", "2026-07-12", "2026-07-19"]));
  it("주중이면 직전 일요일이 이번주 시작", () =>
    // 2026-07-23 = 목요일 → 이번주 시작 7/19
    expect(trendWeekStarts("2026-07-23")).toEqual(["2026-06-28", "2026-07-05", "2026-07-12", "2026-07-19"]));
  it("토요일도 같은 주 (다음 일요일로 넘어가지 않음)", () =>
    expect(trendWeekStarts("2026-07-25")).toEqual(["2026-06-28", "2026-07-05", "2026-07-12", "2026-07-19"]));
  it("월 경계를 넘어도 정상 계산", () =>
    // 2026-08-01 = 토요일 → 이번주 시작 7/26
    expect(trendWeekStarts("2026-08-01")).toEqual(["2026-07-05", "2026-07-12", "2026-07-19", "2026-07-26"]));
});

describe("bucketSessionsByWeek", () => {
  const weeks = ["2026-06-28", "2026-07-05", "2026-07-12", "2026-07-19"];
  const s = (session_date: string, id = session_date) => ({ id, session_date });

  it("각 주에 해당 세션 매핑, 없는 주는 null", () => {
    const result = bucketSessionsByWeek(weeks, [s("2026-07-05"), s("2026-07-19")]);
    expect(result).toEqual([
      { weekStart: "2026-06-28", session: null },
      { weekStart: "2026-07-05", session: s("2026-07-05") },
      { weekStart: "2026-07-12", session: null },
      { weekStart: "2026-07-19", session: s("2026-07-19") },
    ]);
  });

  it("한 주에 세션 여러 개면 마지막(가장 늦은 날짜) 선택", () => {
    // 7/12(일) 주일예배 + 7/15(수) 임시모임 → 7/15
    const result = bucketSessionsByWeek(weeks, [s("2026-07-12"), s("2026-07-15")]);
    expect(result[2]).toEqual({ weekStart: "2026-07-12", session: s("2026-07-15") });
  });

  it("주 경계: 토요일은 그 주, 다음 일요일은 다음 주", () => {
    const result = bucketSessionsByWeek(weeks, [s("2026-07-11"), s("2026-07-12")]);
    expect(result[1]).toEqual({ weekStart: "2026-07-05", session: s("2026-07-11") });
    expect(result[2]).toEqual({ weekStart: "2026-07-12", session: s("2026-07-12") });
  });

  it("4주 창 밖(과거·미래) 세션은 무시", () => {
    const result = bucketSessionsByWeek(weeks, [s("2026-06-27"), s("2026-07-26")]);
    expect(result.every((b) => b.session === null)).toBe(true);
  });
});
