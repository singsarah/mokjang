// 일정표 "템플릿" 엑셀(날짜|시간|제목|설명 헤더)을 결정론적으로 파싱.
// AI(Claude) 호출 없이 바로 등록 가능하게 하기 위한 경로 — app/actions/events-import.ts 와
// tests/unit/parse-event-template.test.ts 양쪽에서 import 하므로 순수 함수만 두고
// next/headers 등 서버 전용 import 는 절대 추가하지 말 것.
import * as XLSX from "xlsx";

export type ExtractedEvent = {
  date: string; // YYYY-MM-DD
  title: string;
  time: string | null; // HH:MM
  description: string | null;
};

export type ParseTemplateResult =
  | { matched: false }
  | { matched: true; events: ExtractedEvent[]; warnings: string[] };

const HEADER_LIMIT = 10; // 헤더 행을 찾는 범위(시트 상단 몇 행까지 확인할지)
const TRAILING_EMPTY_LIMIT = 3; // 이 개수만큼 빈 행이 연속되면 데이터 끝으로 간주

function cellToLabel(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function isEmptyCell(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "string") return v.trim() === "";
  return false;
}

function findHeaderRow(rows: unknown[][]): number {
  const limit = Math.min(HEADER_LIMIT, rows.length);
  for (let i = 0; i < limit; i++) {
    const labels = (rows[i] ?? []).map(cellToLabel);
    if (labels.includes("날짜") && labels.includes("제목")) return i;
  }
  return -1;
}

function formatYMD(y: number, mo: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function isValidYMD(y: number, mo: number, d: number): boolean {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function kstYear(): number {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCFullYear();
}

function parseDateString(s: string): string | null {
  let m = /^(\d{4})[-.\/](\d{1,2})[-.\/](\d{1,2})$/.exec(s);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    return isValidYMD(y, mo, d) ? formatYMD(y, mo, d) : null;
  }
  m = /^(\d{1,2})[-\/](\d{1,2})$/.exec(s);
  if (m) {
    const y = kstYear();
    const mo = Number(m[1]);
    const d = Number(m[2]);
    return isValidYMD(y, mo, d) ? formatYMD(y, mo, d) : null;
  }
  return null;
}

// 엑셀 날짜 셀 → YYYY-MM-DD. cellDates:true 로 읽은 워크북이면 Date, 아니면 serial 숫자,
// 자유 형식이면 문자열로 들어옴. Date 는 항상 UTC 컴포넌트로 읽어 타임존 오프바이원을 피함
// (SheetJS 는 cellDates 사용 시 시트에 적힌 날짜를 UTC 자정 기준 Date 로 만듦).
function parseDateCell(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return formatYMD(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
  }
  if (typeof v === "number") {
    const parsed = XLSX.SSF.parse_date_code(v);
    if (!parsed || !parsed.y) return null;
    return isValidYMD(parsed.y, parsed.m, parsed.d) ? formatYMD(parsed.y, parsed.m, parsed.d) : null;
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (s === "") return null;
    return parseDateString(s);
  }
  return null;
}

function formatHM(h: number, mi: number): string | null {
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

// 엑셀 시간 셀 → HH:MM. null = 값 없음(정상), "invalid" = 값은 있는데 못 읽음(경고용).
function parseTimeCell(v: unknown): string | null | "invalid" {
  if (v == null) return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return "invalid";
    return formatHM(v.getUTCHours(), v.getUTCMinutes()) ?? "invalid";
  }
  if (typeof v === "number") {
    const parsed = XLSX.SSF.parse_date_code(v);
    if (!parsed) return "invalid";
    return formatHM(parsed.H, parsed.M) ?? "invalid";
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (s === "") return null;
    const m = /^(\d{1,2}):(\d{2})$/.exec(s);
    if (!m) return "invalid";
    return formatHM(Number(m[1]), Number(m[2])) ?? "invalid";
  }
  return "invalid";
}

function cellToText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  return String(v).trim();
}

/**
 * 일정표 템플릿(날짜|시간|제목|설명 헤더) 엑셀을 결정론적으로 파싱.
 * 워크북(가급적 XLSX.read(buf, { cellDates: true }) 로 읽은 것)을 받아 시트를 순서대로 훑으며
 * 첫 10행 안에서 "날짜"+"제목" 헤더를 찾는다. 못 찾으면 matched:false (호출자가 AI 경로로 폴백).
 */
export function parseEventTemplate(workbook: XLSX.WorkBook): ParseTemplateResult {
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: true,
      defval: "",
    });
    const headerRowIndex = findHeaderRow(rows);
    if (headerRowIndex === -1) continue;

    const headerLabels = (rows[headerRowIndex] ?? []).map(cellToLabel);
    const col = {
      date: headerLabels.indexOf("날짜"),
      title: headerLabels.indexOf("제목"),
      time: headerLabels.indexOf("시간"),
      description: headerLabels.indexOf("설명"),
    };

    const events: ExtractedEvent[] = [];
    const warnings: string[] = [];
    let consecutiveEmpty = 0;

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i] ?? [];
      const rowNum = i + 1; // 1-indexed, 사용자에게 보여줄 행 번호

      const dateCell = row[col.date];
      const titleCell = row[col.title];
      const timeCell = col.time >= 0 ? row[col.time] : undefined;
      const descCell = col.description >= 0 ? row[col.description] : undefined;

      if (
        isEmptyCell(dateCell) &&
        isEmptyCell(titleCell) &&
        isEmptyCell(timeCell) &&
        isEmptyCell(descCell)
      ) {
        consecutiveEmpty++;
        if (consecutiveEmpty >= TRAILING_EMPTY_LIMIT) break;
        continue;
      }
      consecutiveEmpty = 0;

      const date = parseDateCell(dateCell);
      if (!date) {
        warnings.push(`${rowNum}행: 날짜를 읽을 수 없어 제외`);
        continue;
      }

      const title = cellToText(titleCell);
      if (title === "") {
        warnings.push(`${rowNum}행: 제목이 없어 제외`);
        continue;
      }
      if (title.length > 100) {
        warnings.push(`${rowNum}행: 제목이 너무 길어(100자 초과) 제외`);
        continue;
      }

      let time: string | null = null;
      const timeParsed = parseTimeCell(timeCell);
      if (timeParsed === "invalid") {
        warnings.push(`${rowNum}행: 시간 형식을 읽을 수 없어 시간 없이 등록`);
      } else {
        time = timeParsed;
      }

      const descText = cellToText(descCell);
      let description: string | null = null;
      if (descText !== "") {
        if (descText.length > 500) {
          warnings.push(`${rowNum}행: 설명이 너무 길어(500자 초과) 제외`);
          continue;
        }
        description = descText;
      }

      events.push({ date, title, time, description });
    }

    return { matched: true, events, warnings };
  }

  return { matched: false };
}
