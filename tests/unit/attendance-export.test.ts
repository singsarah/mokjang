import { describe, expect, it } from "vitest";
import {
  attendanceExportHeader,
  attendanceExportRow,
  type AttendanceExportSession,
  type AttendanceExportStudent,
} from "@/lib/attendance-export";

function baseStudent(overrides: Partial<AttendanceExportStudent> = {}): AttendanceExportStudent {
  return {
    name: "홍길동",
    grade: 1,
    className: "1-1",
    graduated: false,
    hidden: false,
    recordsByDate: {},
    ...overrides,
  };
}

const sessions: AttendanceExportSession[] = [
  { date: "2026-06-07" },
  { date: "2026-06-14" },
  { date: "2026-06-21" },
];

describe("attendanceExportHeader", () => {
  it("이름/학년/반 + 세션 날짜 순서로 헤더를 만든다", () => {
    expect(attendanceExportHeader(sessions)).toEqual([
      "이름", "학년", "반", "2026-06-07", "2026-06-14", "2026-06-21",
    ]);
  });

  it("세션이 없으면 기본 3열만 반환한다", () => {
    expect(attendanceExportHeader([])).toEqual(["이름", "학년", "반"]);
  });
});

describe("attendanceExportRow", () => {
  it("헤더와 같은 길이로 열을 정렬한다", () => {
    const row = attendanceExportRow(baseStudent(), sessions);
    expect(row).toHaveLength(attendanceExportHeader(sessions).length);
  });

  it("present는 O로 표시한다", () => {
    const s = baseStudent({
      recordsByDate: { "2026-06-07": { status: "present", reason: null } },
    });
    const row = attendanceExportRow(s, sessions);
    expect(row[3]).toBe("O");
  });

  it("absent_with_reason은 사유 텍스트를 표시한다", () => {
    const s = baseStudent({
      recordsByDate: { "2026-06-14": { status: "absent_with_reason", reason: "여행" } },
    });
    const row = attendanceExportRow(s, sessions);
    expect(row[4]).toBe("여행");
  });

  it("absent_with_reason인데 사유가 비어있으면 '사유'로 표시한다", () => {
    const s = baseStudent({
      recordsByDate: { "2026-06-14": { status: "absent_with_reason", reason: "" } },
    });
    const row = attendanceExportRow(s, sessions);
    expect(row[4]).toBe("사유");

    const s2 = baseStudent({
      recordsByDate: { "2026-06-14": { status: "absent_with_reason", reason: null } },
    });
    expect(attendanceExportRow(s2, sessions)[4]).toBe("사유");
  });

  it("unconfirmed는 X로 표시한다", () => {
    const s = baseStudent({
      recordsByDate: { "2026-06-21": { status: "unconfirmed", reason: null } },
    });
    const row = attendanceExportRow(s, sessions);
    expect(row[5]).toBe("X");
  });

  it("기록이 없는 날짜는 빈 문자열이다", () => {
    const row = attendanceExportRow(baseStudent(), sessions);
    expect(row[3]).toBe("");
    expect(row[4]).toBe("");
    expect(row[5]).toBe("");
  });

  it("졸업생은 이름 뒤에 (졸업)을 붙인다", () => {
    const row = attendanceExportRow(baseStudent({ graduated: true }), sessions);
    expect(row[0]).toBe("홍길동(졸업)");
  });

  it("숨김 학생은 이름 뒤에 (숨김)을 붙인다(졸업이 아닐 때)", () => {
    const row = attendanceExportRow(baseStudent({ hidden: true }), sessions);
    expect(row[0]).toBe("홍길동(숨김)");
  });

  it("졸업이면서 숨김이어도 (졸업)이 우선한다", () => {
    const row = attendanceExportRow(baseStudent({ graduated: true, hidden: true }), sessions);
    expect(row[0]).toBe("홍길동(졸업)");
  });

  it("grade/className이 null이면 빈 문자열", () => {
    const row = attendanceExportRow(baseStudent({ grade: null, className: null }), sessions);
    expect(row[1]).toBe("");
    expect(row[2]).toBe("");
  });

  it("세션이 3개면 날짜 열도 3개다(전체 열 = 3 + 3)", () => {
    const row = attendanceExportRow(baseStudent(), sessions);
    expect(row).toHaveLength(6);
  });
});
