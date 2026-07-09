import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseEventTemplate } from "@/lib/parse-event-template";

function wbFromRows(rows: unknown[][]): XLSX.WorkBook {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "일정");
  return wb;
}

// 실제 파일 경로를 그대로 재현: 워크북을 xlsx 바이너리로 썼다가 cellDates:true 로 다시 읽음
// (Date 셀이 UTC 자정 기준으로 정확히 왕복하는지까지 검증).
function roundTrip(wb: XLSX.WorkBook): XLSX.WorkBook {
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return XLSX.read(buf, { cellDates: true });
}

describe("parseEventTemplate", () => {
  it("첫 행이 아니어도 날짜+제목 헤더를 찾는다", () => {
    const wb = wbFromRows([
      ["고등부 일정 안내"],
      [],
      ["날짜", "시간", "제목", "설명"],
      ["2026-07-19", "11:00", "연합예배", "소망홀"],
    ]);
    const result = parseEventTemplate(wb);
    expect(result.matched).toBe(true);
    if (!result.matched) return;
    expect(result.events).toEqual([
      { date: "2026-07-19", title: "연합예배", time: "11:00", description: "소망홀" },
    ]);
  });

  it("YYYY-MM-DD 문자열 날짜를 파싱한다", () => {
    const wb = wbFromRows([
      ["날짜", "제목"],
      ["2026-08-02", "여름수련회"],
    ]);
    const result = parseEventTemplate(wb);
    expect(result.matched).toBe(true);
    if (!result.matched) return;
    expect(result.events[0].date).toBe("2026-08-02");
  });

  it("YYYY.MM.DD / YYYY/MM/DD 도 파싱한다", () => {
    const wb = wbFromRows([
      ["날짜", "제목"],
      ["2026.08.02", "A"],
      ["2026/08/03", "B"],
    ]);
    const result = parseEventTemplate(wb);
    expect(result.matched).toBe(true);
    if (!result.matched) return;
    expect(result.events.map((e) => e.date)).toEqual(["2026-08-02", "2026-08-03"]);
  });

  it("M/D 는 현재 연도로 추론한다", () => {
    const wb = wbFromRows([
      ["날짜", "제목"],
      ["8/2", "여름수련회"],
    ]);
    const result = parseEventTemplate(wb);
    expect(result.matched).toBe(true);
    if (!result.matched) return;
    const year = new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCFullYear();
    expect(result.events[0].date).toBe(`${year}-08-02`);
  });

  it("엑셀 날짜 셀(Date, cellDates 왕복)을 UTC 기준으로 정확히 읽는다", () => {
    const wb = roundTrip(
      wbFromRows([
        ["날짜", "제목"],
        [new Date(Date.UTC(2026, 6, 19)), "연합예배"],
      ]),
    );
    const result = parseEventTemplate(wb);
    expect(result.matched).toBe(true);
    if (!result.matched) return;
    expect(result.events[0].date).toBe("2026-07-19");
  });

  it("엑셀 시간 소수값과 '9:30' 문자열을 모두 HH:MM 으로 정규화한다", () => {
    const wb = wbFromRows([
      ["날짜", "시간", "제목"],
      ["2026-07-19", 0.4375, "오전예배"], // 10:30
      ["2026-07-20", "9:30", "오전기도회"],
    ]);
    const result = parseEventTemplate(wb);
    expect(result.matched).toBe(true);
    if (!result.matched) return;
    expect(result.events[0].time).toBe("10:30");
    expect(result.events[1].time).toBe("09:30");
  });

  it("날짜를 읽을 수 없는 행은 제외하고 경고를 남긴다", () => {
    const wb = wbFromRows([
      ["날짜", "제목"],
      ["이상한날짜", "제목있음"],
      ["2026-07-19", "정상행"],
    ]);
    const result = parseEventTemplate(wb);
    expect(result.matched).toBe(true);
    if (!result.matched) return;
    expect(result.events).toEqual([
      { date: "2026-07-19", title: "정상행", time: null, description: null },
    ]);
    expect(result.warnings.some((w) => w.includes("날짜"))).toBe(true);
  });

  it("날짜/제목 헤더가 없으면 matched:false 를 반환한다", () => {
    const wb = wbFromRows([
      ["이름", "생일", "전화번호"],
      ["홍길동", "1/1", "01012345678"],
    ]);
    const result = parseEventTemplate(wb);
    expect(result).toEqual({ matched: false });
  });

  it("연속된 빈 행 이후는 데이터로 취급하지 않는다", () => {
    const wb = wbFromRows([
      ["날짜", "제목"],
      ["2026-07-19", "연합예배"],
      ["", "", "", ""],
      ["", "", "", ""],
      ["", "", "", ""],
      ["2026-12-25", "숨은행"],
    ]);
    const result = parseEventTemplate(wb);
    expect(result.matched).toBe(true);
    if (!result.matched) return;
    expect(result.events).toEqual([
      { date: "2026-07-19", title: "연합예배", time: null, description: null },
    ]);
  });
});
