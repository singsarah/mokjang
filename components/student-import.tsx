"use client";

import Link from "next/link";
import { useState, useTransition, type ChangeEvent } from "react";
import { importStudents, type ImportRow, type ImportResult } from "@/app/actions/students";
import { parseParents } from "@/lib/parse-parents";
import { excelDateToYmd } from "@/lib/excel-date";

// 엑셀 열 이름(한국어) → 내부 원시 필드. 실파일 열명과 깔끔한 양식 열명을 모두 별칭으로 지원.
// 열 순서는 무관, 이름으로 매핑.
const HEADER_MAP: Record<string, keyof RawRow> = {
  이름: "name",
  학년: "gradeRaw", // "1-1" 결합 또는 "1" 단독 모두 허용
  반: "className",
  성별: "gender",
  생일: "birthday",
  전화번호: "phoneSelf",
  "본인 연락처": "phoneSelf",
  "카카오톡 ID": "kakaoId",
  "카카오톡ID": "kakaoId",
  카톡ID: "kakaoId",
  주소: "address",
  학교: "school",
  "세례/입교 여부": "baptism",
  "세례/입교": "baptism",
  세례입교: "baptism",
  가족: "familyNote",
  비고: "note",
  "학부모 단톡방 초대 여부": "chatRaw",
  "단톡방 초대": "chatRaw",
  단톡방: "chatRaw",
  등록지원서: "regRaw",
  "등록지원서 제출": "regRaw",
  부모님: "parentsRaw",
  "보호자1 관계": "g1Relation",
  "보호자1 이름": "g1Name",
  "보호자1 연락처": "g1Phone",
  "보호자2 관계": "g2Relation",
  "보호자2 이름": "g2Name",
  "보호자2 연락처": "g2Phone",
};

// 다운로드 양식(깔끔한 열 이름) + 예시 1행.
const HEADERS = [
  "이름", "학년", "성별", "반", "생일", "전화번호", "카카오톡 ID", "학교", "주소",
  "보호자1 관계", "보호자1 이름", "보호자1 연락처",
  "보호자2 관계", "보호자2 이름", "보호자2 연락처",
  "세례/입교", "가족", "비고", "단톡방 초대", "등록지원서",
];
const EXAMPLE = [
  "홍길동", "1", "남", "1-1", "2010-05-03", "91234567", "hong_kakao", "OO고", "Blk 123 Example Rd",
  "엄마", "홍엄마", "97860554",
  "아빠", "홍아빠", "85331576",
  "유아세례", "형 1명", "조용한 편", "O", "O",
];

type RawRow = {
  name: string;
  gradeRaw: string;
  className: string;
  gender: string;
  birthday: string;
  phoneSelf: string;
  kakaoId: string;
  address: string;
  school: string;
  baptism: string;
  familyNote: string;
  note: string;
  chatRaw: string;
  regRaw: string;
  parentsRaw: string;
  g1Relation: string;
  g1Name: string;
  g1Phone: string;
  g2Relation: string;
  g2Name: string;
  g2Phone: string;
};

// 처리 후 행 — 미리보기 표시 + 서버 전송용 파생값.
type Checked = {
  name: string;
  gradeRaw: string;
  gradeNum: number | null;
  className: string;
  gender: string;
  birthday: string;
  phoneSelf: string;
  kakaoId: string;
  address: string;
  school: string;
  baptism: string;
  familyNote: string;
  note: string;
  parentChatInvited: boolean;
  registrationSubmitted: boolean;
  g1Relation: string;
  g1Name: string;
  g1Phone: string;
  g2Relation: string;
  g2Name: string;
  g2Phone: string;
  valid: boolean;
  reason?: string;
  warn?: string;
};

// 셀 값을 문자열로 정규화(엑셀 날짜 셀은 Date, 전화번호 숫자 셀은 number 로 들어옴).
// 날짜 셀은 excelDateToYmd 로 — 로컬 컴포넌트를 그대로 읽으면 하루 당겨짐 (lib/excel-date.ts 참고).
function cell(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return excelDateToYmd(v) ?? "";
  return String(v).trim();
}

// O / o / ㅇ / y / 유 / 1 등 → true, 빈값 / X → false.
function parseBool(s: string): boolean {
  const v = s.trim().toLowerCase();
  return ["o", "ㅇ", "y", "yes", "유", "true", "1", "예", "v", "✓"].includes(v);
}

const relLabel: Record<string, string> = { 모: "엄마", 부: "아빠", 기타: "기타" };

function guardianSummary(r: Checked): string {
  const parts: string[] = [];
  const one = (rel: string, name: string, phone: string) => {
    const seg = [relLabel[rel] ?? rel, name, phone].filter((x) => x && x.trim() !== "").join(" ");
    if (seg) parts.push(seg);
  };
  one(r.g1Relation, r.g1Name, r.g1Phone);
  one(r.g2Relation, r.g2Name, r.g2Phone);
  return parts.join(" · ");
}

function processRow(raw: RawRow): Checked {
  // 학년 파싱: "3-1 (4학년)" → 괄호 제거, "1-1" 결합이면 반 이름으로.
  let gradeSrc = raw.gradeRaw.trim();
  let parenWarn = false;
  if (gradeSrc.includes("(")) {
    parenWarn = true;
    gradeSrc = gradeSrc.split("(")[0].trim();
  }
  const gm = gradeSrc.match(/(\d)/);
  const g = gm ? parseInt(gm[1], 10) : null;
  const gradeNum = g === 1 || g === 2 || g === 3 ? g : null;

  let className = raw.className.trim();
  if (!className && gradeSrc.includes("-")) className = gradeSrc;

  // 보호자: 깔끔한 열이 하나라도 있으면 그것을 사용, 없으면 '부모님' 자유텍스트 파싱.
  let g1Relation = raw.g1Relation.trim();
  let g1Name = raw.g1Name.trim();
  let g1Phone = raw.g1Phone.trim();
  let g2Relation = raw.g2Relation.trim();
  let g2Name = raw.g2Name.trim();
  let g2Phone = raw.g2Phone.trim();
  let parentWarn: string | undefined;
  const hasExplicit = [g1Relation, g1Name, g1Phone, g2Relation, g2Name, g2Phone].some((v) => v !== "");
  if (!hasExplicit && raw.parentsRaw.trim()) {
    const p = parseParents(raw.parentsRaw);
    if (p.guardian1) {
      g1Relation = p.guardian1.relation ?? "";
      g1Name = p.guardian1.name;
      g1Phone = p.guardian1.phone;
    }
    if (p.guardian2) {
      g2Relation = p.guardian2.relation ?? "";
      g2Name = p.guardian2.name;
      g2Phone = p.guardian2.phone;
    }
    parentWarn = p.warning;
  }

  let valid = true;
  let reason: string | undefined;
  if (raw.name.trim() === "") {
    valid = false;
    reason = "이름 없음";
  } else if (gradeNum === null) {
    valid = false;
    reason = "학년은 1·2·3만 가능";
  }

  const warns: string[] = [];
  if (parenWarn) warns.push("학년 괄호 표기 정리됨");
  if (parentWarn) warns.push(parentWarn);

  return {
    name: raw.name.trim(),
    gradeRaw: raw.gradeRaw.trim(),
    gradeNum,
    className,
    gender: raw.gender.trim(),
    birthday: raw.birthday.trim(),
    phoneSelf: raw.phoneSelf.trim(),
    kakaoId: raw.kakaoId.trim(),
    address: raw.address.trim(),
    school: raw.school.trim(),
    baptism: raw.baptism.trim(),
    familyNote: raw.familyNote.trim(),
    note: raw.note.trim(),
    parentChatInvited: parseBool(raw.chatRaw),
    registrationSubmitted: parseBool(raw.regRaw),
    g1Relation,
    g1Name,
    g1Phone,
    g2Relation,
    g2Name,
    g2Phone,
    valid,
    reason,
    warn: warns.length > 0 ? warns.join(" · ") : undefined,
  };
}

function emptyRaw(): RawRow {
  return {
    name: "", gradeRaw: "", className: "", gender: "", birthday: "", phoneSelf: "",
    kakaoId: "", address: "", school: "", baptism: "", familyNote: "", note: "",
    chatRaw: "", regRaw: "", parentsRaw: "",
    g1Relation: "", g1Name: "", g1Phone: "", g2Relation: "", g2Name: "", g2Phone: "",
  };
}

export function StudentImport() {
  const [rows, setRows] = useState<Checked[]>([]);
  const [fileName, setFileName] = useState<string>();
  const [parseError, setParseError] = useState<string>();
  const [result, setResult] = useState<ImportResult>();
  const [isPending, startTransition] = useTransition();

  async function onDownloadTemplate() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([HEADERS, EXAMPLE]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "학생");
    XLSX.writeFile(wb, "학생_업로드_양식.xlsx");
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
      const sheet = wb.Sheets[wb.SheetNames[0]];
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
      // 완전히 빈 행 제외(이름·학년·전화 등 아무 내용도 없는 행).
      const nonEmpty = parsed.filter(
        (r) =>
          r.name !== "" ||
          r.gradeRaw !== "" ||
          r.phoneSelf !== "" ||
          r.g1Name !== "" ||
          r.g1Phone !== "",
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
    const payload: ImportRow[] = validRows.map((r) => ({
      name: r.name,
      grade: r.gradeNum!, // valid 행은 gradeNum 보장
      gender: r.gender,
      className: r.className,
      phoneSelf: r.phoneSelf,
      birthday: r.birthday,
      guardian1Relation: r.g1Relation,
      guardian1Name: r.g1Name,
      guardian1Phone: r.g1Phone,
      guardian2Relation: r.g2Relation,
      guardian2Name: r.g2Name,
      guardian2Phone: r.g2Phone,
      school: r.school,
      baptism: r.baptism,
      kakaoId: r.kakaoId,
      address: r.address,
      familyNote: r.familyNote,
      note: r.note,
      parentChatInvited: r.parentChatInvited,
      registrationSubmitted: r.registrationSubmitted,
    }));
    startTransition(async () => {
      const res = await importStudents(payload);
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
              <p className="text-sm font-medium text-ink">건너뛴 학생 {result.skipped.length}명</p>
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
          href="/settings/roster"
          className="block w-full rounded-btn bg-sage py-3 text-center font-medium text-white shadow-sm transition hover:bg-sage-deep"
        >
          학적부로 가기
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
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={onPickFile}
          />
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
                  <th className="px-2 py-1.5 text-left font-medium">학년</th>
                  <th className="px-2 py-1.5 text-left font-medium">반</th>
                  <th className="px-2 py-1.5 text-left font-medium">성별</th>
                  <th className="px-2 py-1.5 text-left font-medium">생일</th>
                  <th className="px-2 py-1.5 text-left font-medium">보호자</th>
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
                      {r.valid && r.warn && (
                        <span className="ml-1 text-amber-700">· {r.warn}</span>
                      )}
                    </td>
                    <td className={cellCls}>{r.gradeNum ?? r.gradeRaw}</td>
                    <td className={cellCls}>{r.className}</td>
                    <td className={cellCls}>{r.gender}</td>
                    <td className={cellCls}>{r.birthday}</td>
                    <td className={cellCls}>{guardianSummary(r)}</td>
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
