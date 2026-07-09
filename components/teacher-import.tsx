"use client";

import Link from "next/link";
import { useState, useTransition, type ChangeEvent } from "react";
import {
  importTeachers,
  type TeacherImportRow,
  type TeacherImportResult,
} from "@/app/actions/teachers";

// 엑셀 열 이름(한국어) → 내부 원시 필드. 실파일 열명과 양식 열명을 모두 별칭으로 지원.
// 열 순서는 무관, 이름으로 매핑.
const HEADER_MAP: Record<string, keyof RawRow> = {
  이름: "name",
  성명: "name",
  생일: "birthday",
  생년월일: "birthday",
  전화번호: "phone",
  연락처: "phone",
  "카카오톡 ID": "kakaoId",
  "카카오톡ID": "kakaoId",
  카톡ID: "kakaoId",
  담당: "duty",
  "직장인/학생": "jobType",
  "직장인·학생": "jobType",
  직장인학생: "jobType",
  구분: "jobType",
  비고: "note",
};

// 다운로드 양식(깔끔한 열 이름) + 예시 1행.
const HEADERS = ["이름", "생일", "전화번호", "카카오톡 ID", "담당", "직장인/학생", "비고"];
const EXAMPLE = ["홍길동", "4/9", "91234567", "hong_kakao", "찬양팀", "직장인", ""];

type RawRow = {
  name: string;
  birthday: string;
  phone: string;
  kakaoId: string;
  duty: string;
  jobType: string;
  note: string;
};

// 처리 후 행 — 미리보기 표시 + 서버 전송용.
type Checked = RawRow & {
  valid: boolean;
  reason?: string;
};

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

// 셀 값을 문자열로 정규화(엑셀 날짜 셀은 Date, 전화번호 숫자 셀은 number 로 들어옴).
function cell(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return fmtDate(v);
  return String(v).trim();
}

function emptyRaw(): RawRow {
  return { name: "", birthday: "", phone: "", kakaoId: "", duty: "", jobType: "", note: "" };
}

function processRow(raw: RawRow): Checked {
  const valid = raw.name.trim() !== "";
  return {
    name: raw.name.trim(),
    birthday: raw.birthday.trim(),
    phone: raw.phone.trim(),
    kakaoId: raw.kakaoId.trim(),
    duty: raw.duty.trim(),
    jobType: raw.jobType.trim(),
    note: raw.note.trim(),
    valid,
    reason: valid ? undefined : "이름 없음",
  };
}

// 시트 이름에 "교사"가 포함된 시트를 우선 선택, 없으면 첫 시트.
function pickSheetName(names: string[]): string | undefined {
  return names.find((n) => n.includes("교사")) ?? names[0];
}

export function TeacherImport() {
  const [rows, setRows] = useState<Checked[]>([]);
  const [fileName, setFileName] = useState<string>();
  const [parseError, setParseError] = useState<string>();
  const [result, setResult] = useState<TeacherImportResult>();
  const [isPending, startTransition] = useTransition();

  async function onDownloadTemplate() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([HEADERS, EXAMPLE]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "교사");
    XLSX.writeFile(wb, "교사_업로드_양식.xlsx");
  }

  async function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(undefined);
    setResult(undefined);
    setRows([]);
    setFileName(file.name);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { cellDates: true });
      const sheetName = pickSheetName(wb.SheetNames);
      const sheet = sheetName ? wb.Sheets[sheetName] : undefined;
      if (!sheet) {
        setParseError("시트를 찾을 수 없습니다");
        return;
      }
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const parsed: Checked[] = json.map((rawJson) => {
        const base = emptyRaw();
        for (const rawKey of Object.keys(rawJson)) {
          const field = HEADER_MAP[rawKey.trim()];
          if (field) base[field] = cell(rawJson[rawKey]);
        }
        return processRow(base);
      });
      // 완전히 빈 행 제외.
      const nonEmpty = parsed.filter(
        (r) => r.name !== "" || r.phone !== "" || r.duty !== "" || r.kakaoId !== "",
      );
      if (nonEmpty.length === 0) {
        setParseError("데이터 행을 찾을 수 없습니다. 양식을 확인해주세요.");
        return;
      }
      setRows(nonEmpty);
    } catch {
      setParseError("파일을 읽을 수 없습니다. 엑셀(.xlsx) 파일인지 확인해주세요.");
    }
  }

  const validRows = rows.filter((r) => r.valid);
  const errorCount = rows.length - validRows.length;

  function onSubmit() {
    const payload: TeacherImportRow[] = validRows.map((r) => ({
      name: r.name,
      birthday: r.birthday,
      phone: r.phone,
      kakaoId: r.kakaoId,
      duty: r.duty,
      jobType: r.jobType,
      note: r.note,
    }));
    startTransition(async () => {
      const res = await importTeachers(payload);
      setResult(res);
    });
  }

  // 결과 화면.
  if (result && !result.error) {
    return (
      <div className="space-y-4">
        <div className="rounded-card border border-border/60 bg-white p-5 shadow-sm">
          <p className="text-lg font-bold text-ink">{result.inserted}명 등록됨</p>
          {result.skipped.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-ink">건너뛴 교사 {result.skipped.length}명</p>
              <ul className="mt-1 space-y-0.5 text-sm text-ink-muted">
                {result.skipped.map((s, i) => (
                  <li key={i}>
                    {s.name} — {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.warnings.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-amber-700">알림 {result.warnings.length}건</p>
              <ul className="mt-1 space-y-0.5 text-sm text-ink-muted">
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <Link
          href="/settings/teachers"
          className="block w-full rounded-btn bg-sage py-3 text-center font-medium text-white shadow-sm transition hover:bg-sage-deep"
        >
          교사 관리로 가기
        </Link>
      </div>
    );
  }

  const cellCls = "whitespace-nowrap px-2 py-1.5 text-ink";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onDownloadTemplate}
          className="rounded-btn border border-border bg-white px-4 py-2 text-sm text-ink shadow-sm transition hover:bg-card"
        >
          양식 다운로드
        </button>
        <label className="inline-block cursor-pointer rounded-btn border border-border bg-white px-4 py-2 text-sm text-ink shadow-sm transition hover:bg-card">
          {fileName ? "다른 파일 선택" : "엑셀 파일 선택"}
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={onPickFile} />
        </label>
        {fileName && <span className="text-sm text-ink-muted">{fileName}</span>}
      </div>

      {parseError && <p className="text-sm text-danger">{parseError}</p>}
      {result?.error && <p className="text-sm text-danger">{result.error}</p>}

      {rows.length > 0 && (
        <>
          <p className="text-sm text-ink-muted">
            총 {rows.length}행 · 등록 가능 <span className="font-medium text-ink">{validRows.length}</span>
            {errorCount > 0 && (
              <>
                {" "}
                · 오류 <span className="font-medium text-danger">{errorCount}</span>
              </>
            )}
          </p>

          <div className="overflow-x-auto rounded-card border border-border/60 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-card text-ink-muted">
                  <th className="px-2 py-1.5 text-left font-medium">이름</th>
                  <th className="px-2 py-1.5 text-left font-medium">생일</th>
                  <th className="px-2 py-1.5 text-left font-medium">전화</th>
                  <th className="px-2 py-1.5 text-left font-medium">담당</th>
                  <th className="px-2 py-1.5 text-left font-medium">구분</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={i}
                    className={`border-b border-border/40 last:border-0 ${r.valid ? "" : "bg-red-50"}`}
                  >
                    <td className={cellCls}>
                      {r.name || <span className="text-danger">(없음)</span>}
                      {!r.valid && <span className="ml-1 text-danger">· {r.reason}</span>}
                    </td>
                    <td className={cellCls}>{r.birthday}</td>
                    <td className={cellCls}>{r.phone}</td>
                    <td className={cellCls}>{r.duty}</td>
                    <td className={cellCls}>{r.jobType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={onSubmit}
            disabled={isPending || validRows.length === 0}
            className="w-full rounded-btn bg-sage py-3 font-medium text-white shadow-sm transition hover:bg-sage-deep disabled:opacity-50"
          >
            {isPending ? "등록 중…" : `${validRows.length}명 등록`}
          </button>
        </>
      )}
    </div>
  );
}
