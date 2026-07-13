import { describe, expect, it } from "vitest";
import {
  hasSchedule,
  isMeetingDate,
  latestMeetingOnOrBefore,
  nextMeetingDate,
  prevMeetingDate,
  shiftDate,
  weekdayOf,
} from "@/lib/meeting-schedule";

// 2026-07-12 = 일요일, 07-13 = 월요일, 07-19 = 다음 일요일.

describe("weekdayOf / shiftDate", () => {
  it("returns JS getDay convention (0=일)", () => {
    expect(weekdayOf("2026-07-12")).toBe(0);
    expect(weekdayOf("2026-07-13")).toBe(1);
    expect(weekdayOf("2026-07-18")).toBe(6);
  });

  it("shifts across month boundaries", () => {
    expect(shiftDate("2026-07-31", 1)).toBe("2026-08-01");
    expect(shiftDate("2026-08-01", -1)).toBe("2026-07-31");
  });
});

describe("prev/next meeting date (정기 요일)", () => {
  it("월요일에서 일요일 모임을 찾는다", () => {
    expect(prevMeetingDate("2026-07-13", [0], [])).toBe("2026-07-12");
    expect(nextMeetingDate("2026-07-13", [0], [])).toBe("2026-07-19");
  });

  it("모임일 당일에선 한 주 전/후로 이동한다", () => {
    expect(prevMeetingDate("2026-07-12", [0], [])).toBe("2026-07-05");
    expect(nextMeetingDate("2026-07-12", [0], [])).toBe("2026-07-19");
  });

  it("복수 요일(일+수)을 오간다", () => {
    // 07-15 = 수요일
    expect(nextMeetingDate("2026-07-13", [0, 3], [])).toBe("2026-07-15");
    expect(prevMeetingDate("2026-07-15", [0, 3], [])).toBe("2026-07-12");
    expect(nextMeetingDate("2026-07-15", [0, 3], [])).toBe("2026-07-19");
  });

  it("요일 미설정이면 정기 후보가 없다", () => {
    expect(prevMeetingDate("2026-07-13", [], [])).toBeNull();
    expect(nextMeetingDate("2026-07-13", [], [])).toBeNull();
  });
});

describe("임시 모임/기존 기록 날짜(otherDates) 결합", () => {
  it("정기 요일보다 가까운 임시 모임이 이긴다", () => {
    // 07-16(목)에서: 정기 일요일은 07-12, 임시 07-15(수)가 더 가깝다
    expect(prevMeetingDate("2026-07-16", [0], ["2026-07-15"])).toBe("2026-07-15");
    // 다음: 정기 07-19 vs 임시 07-17 → 07-17
    expect(nextMeetingDate("2026-07-16", [0], ["2026-07-17"])).toBe("2026-07-17");
  });

  it("7일 넘게 떨어진 기록 날짜도 찾는다 (요일 미설정)", () => {
    expect(prevMeetingDate("2026-07-13", [], ["2026-06-01"])).toBe("2026-06-01");
    expect(nextMeetingDate("2026-07-13", [], ["2026-09-01"])).toBe("2026-09-01");
  });

  it("당일과 같은 날짜는 prev/next에서 제외된다", () => {
    expect(prevMeetingDate("2026-07-13", [], ["2026-07-13"])).toBeNull();
    expect(nextMeetingDate("2026-07-13", [], ["2026-07-13"])).toBeNull();
  });
});

describe("latestMeetingOnOrBefore (출석 화면 기본 날짜)", () => {
  it("월요일(7/13)에 들어가면 어제 일요일(7/12)이 뜬다", () => {
    expect(latestMeetingOnOrBefore("2026-07-13", [0], [])).toBe("2026-07-12");
  });

  it("일요일 당일이면 오늘이 뜬다", () => {
    expect(latestMeetingOnOrBefore("2026-07-19", [0], [])).toBe("2026-07-19");
  });

  it("오늘이 임시 모임이면 오늘이 뜬다", () => {
    expect(latestMeetingOnOrBefore("2026-07-14", [0], ["2026-07-14"])).toBe("2026-07-14");
  });

  it("아무 후보도 없으면 null", () => {
    expect(latestMeetingOnOrBefore("2026-07-13", [], [])).toBeNull();
  });
});

describe("hasSchedule / isMeetingDate", () => {
  it("요일이나 임시 모임이 하나라도 있으면 true", () => {
    expect(hasSchedule([], [])).toBe(false);
    expect(hasSchedule([0], [])).toBe(true);
    expect(hasSchedule([], ["2026-07-15"])).toBe(true);
  });

  it("정기 요일 또는 임시 날짜와 일치하면 모임일", () => {
    expect(isMeetingDate("2026-07-12", [0], [])).toBe(true);
    expect(isMeetingDate("2026-07-13", [0], [])).toBe(false);
    expect(isMeetingDate("2026-07-13", [0], ["2026-07-13"])).toBe(true);
  });
});
