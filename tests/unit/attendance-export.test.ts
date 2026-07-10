import { describe, expect, it } from "vitest";
import {
  attendanceExportHeader,
  attendanceExportRow,
  attendanceExportSummaryRows,
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

describe("attendanceExportSummaryRows", () => {
  const oneSession: AttendanceExportSession[] = [{ date: "2026-06-07" }];

  function roster(): AttendanceExportStudent[] {
    return [
      baseStudent({
        name: "출석1", grade: 1, className: "1반",
        recordsByDate: { "2026-06-07": { status: "present", reason: null } },
      }),
      baseStudent({
        name: "출석2", grade: 2, className: "2반",
        recordsByDate: { "2026-06-07": { status: "present", reason: null } },
      }),
      baseStudent({
        name: "사유", grade: 1, className: "1반",
        recordsByDate: { "2026-06-07": { status: "absent_with_reason", reason: "여행" } },
      }),
      // 기록 없음 + 반(1반)이 그 날 활동 → 미확인으로 집계
      baseStudent({ name: "미체크", grade: 1, className: "1반", recordsByDate: {} }),
      // 기록 없음 + 반(3반)은 그 날 활동 없음 → 집계 안 됨
      baseStudent({ name: "쉬는반", grade: 3, className: "3반", recordsByDate: {} }),
    ];
  }

  function findRow(rows: (string | number)[][], label: string) {
    return rows.find((r) => r[0] === label);
  }

  it("출석/사유결석/미확인 합계를 날짜별로 계산한다", () => {
    const rows = attendanceExportSummaryRows(roster(), oneSession);
    expect(findRow(rows, "출석 합계")![3]).toBe(2);
    expect(findRow(rows, "사유결석 합계")![3]).toBe(1);
    expect(findRow(rows, "미확인 합계")![3]).toBe(1); // 미체크(1반 활동) 1명, 쉬는반은 제외
  });

  it("학년별·반별 출석은 '출석 n/재적 m' 형식", () => {
    const rows = attendanceExportSummaryRows(roster(), oneSession);
    expect(findRow(rows, "1학년 출석")![3]).toBe("1/3"); // 출석1 / (출석1·사유·미체크)
    expect(findRow(rows, "2학년 출석")![3]).toBe("1/1");
    expect(findRow(rows, "1반 출석")![3]).toBe("1/3");
    expect(findRow(rows, "2반 출석")![3]).toBe("1/1");
  });

  it("졸업·숨김 학생은 미확인·분모에서 제외하되 기록 자체는 합계에 남는다", () => {
    const students = [
      ...roster(),
      baseStudent({
        name: "졸업생", grade: 3, className: "1반", graduated: true,
        recordsByDate: { "2026-06-07": { status: "present", reason: null } },
      }),
      // 졸업 + 기록 없음: 1반이 활동해도 미확인으로 세지 않는다
      baseStudent({ name: "졸업무기록", grade: 3, className: "1반", graduated: true, recordsByDate: {} }),
    ];
    const rows = attendanceExportSummaryRows(students, oneSession);
    expect(findRow(rows, "출석 합계")![3]).toBe(3); // 졸업생의 과거 출석도 합계에 포함
    expect(findRow(rows, "미확인 합계")![3]).toBe(1);
    expect(findRow(rows, "1반 출석")![3]).toBe("1/3"); // 재적 기준 분모(졸업 제외)
  });

  it("세션이나 학생이 없으면 빈 배열", () => {
    expect(attendanceExportSummaryRows([], oneSession)).toEqual([]);
    expect(attendanceExportSummaryRows(roster(), [])).toEqual([]);
  });

  it("요약 행의 열 수는 본문과 같다 (라벨 + 빈칸2 + 날짜들)", () => {
    const rows = attendanceExportSummaryRows(roster(), sessions);
    const expected = attendanceExportHeader(sessions).length;
    for (const r of rows) {
      if (r.length > 0) expect(r).toHaveLength(expected);
    }
  });
});
