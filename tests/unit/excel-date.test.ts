import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { excelDateToYmd } from "@/lib/excel-date";

describe("excelDateToYmd", () => {
  it("로컬 자정 Date → 그 날짜", () => {
    expect(excelDateToYmd(new Date(2010, 0, 4))).toBe("2010-01-04");
  });

  it("자정보다 몇 초 이른 Date(SheetJS cellDates 의 역사적 타임존 오차) → 의도한 날짜", () => {
    // Asia/Singapore 등 1900년 이전 LMT 오프셋에 초 단위가 있는 지역에서
    // SheetJS numdate 가 만드는 실제 값: 로컬 자정 - 25초 (= 전날 23:59:35)
    const d = new Date(new Date(2010, 0, 4).getTime() - 25_000);
    expect(excelDateToYmd(d)).toBe("2010-01-04");
  });

  it("UTC 자정 Date → 그 날짜", () => {
    expect(excelDateToYmd(new Date(Date.UTC(2026, 6, 19)))).toBe("2026-07-19");
  });

  it("Invalid Date → null", () => {
    expect(excelDateToYmd(new Date(NaN))).toBeNull();
  });
});

// 실제 버그 경로 재현: 구글 시트 export 처럼 date serial + 날짜 서식으로 저장된 셀을
// XLSX.read(..., { cellDates: true }) 로 읽으면 Date 가 자정보다 몇 초 일찍 나온다.
// 그 Date 를 excelDateToYmd 로 읽으면 날짜가 밀리지 않아야 한다.
describe("date serial 셀 cellDates:true 왕복", () => {
  function readDateCell(serial: number): unknown {
    const ws = XLSX.utils.aoa_to_sheet([["생일"], [serial]]);
    (ws["A2"] as XLSX.CellObject).z = "yyyy-mm-dd";
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "s");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const back = XLSX.read(buf, { cellDates: true });
    return back.Sheets["s"]["A2"].v;
  }

  it("serial 40182 → 2010-01-04 (원본 학적부에서 하루 당겨졌던 케이스)", () => {
    const v = readDateCell(40182);
    expect(v).toBeInstanceOf(Date);
    expect(excelDateToYmd(v as Date)).toBe("2010-01-04");
  });

  it("serial 40360 → 2010-07-01", () => {
    const v = readDateCell(40360);
    expect(v).toBeInstanceOf(Date);
    expect(excelDateToYmd(v as Date)).toBe("2010-07-01");
  });
});
