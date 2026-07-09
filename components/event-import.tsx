"use client";

import Link from "next/link";
import { useState, type ChangeEvent } from "react";
import {
  extractEventsFromFile,
  confirmImportedEvents,
  type ExtractedEvent,
  type EventImportResult,
} from "@/app/actions/events-import";

const ACCEPT = ".jpg,.jpeg,.png,.webp,.pdf,.xlsx,.xls";
const MAX_BYTES = 10 * 1024 * 1024; // 10MB (PDF/엑셀)
const MAX_EDGE = 2000; // 이미지 긴 변 최대 픽셀

// 템플릿 다운로드 양식(날짜|시간|제목|설명) + 예시 2행.
const TEMPLATE_HEADERS = ["날짜", "시간", "제목", "설명"];
const TEMPLATE_EXAMPLES = [
  ["2026-07-19", "11:00", "중고등부연합예배", "소망홀"],
  ["2026-07-26", "", "여름수련회 준비모임", ""],
];

type Row = ExtractedEvent & {
  key: number;
  include: boolean;
};

function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp)$/i.test(file.name);
}

// 업로드 전 캔버스로 축소(긴 변 2000px, JPEG 0.85) — 페이로드를 작게 유지.
async function downscaleImage(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("이미지를 읽을 수 없습니다"));
      im.src = url;
    });
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("이미지 처리에 실패했습니다");
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (!blob) throw new Error("이미지 변환에 실패했습니다");
    return new File([blob], "schedule.jpg", { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function onDownloadTemplate() {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...TEMPLATE_EXAMPLES]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "일정");
  XLSX.writeFile(wb, "일정_템플릿.xlsx");
}

export function EventImport() {
  const [fileName, setFileName] = useState<string>();
  const [rows, setRows] = useState<Row[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<EventImportResult>();
  const [nextKey, setNextKey] = useState(0);

  async function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일 재선택 허용
    if (!file) return;

    setError(undefined);
    setResult(undefined);
    setWarnings([]);
    setRows([]);
    setFileName(file.name);

    let upload: File = file;
    try {
      if (isImageFile(file)) {
        upload = await downscaleImage(file);
      } else if (file.size > MAX_BYTES) {
        setError("파일이 너무 큽니다. 10MB 이하의 파일을 사용해주세요.");
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "파일을 처리할 수 없습니다");
      return;
    }

    setExtracting(true);
    try {
      const fd = new FormData();
      fd.append("file", upload, upload.name);
      const res = await extractEventsFromFile(fd);
      if (res.error) {
        setError(res.error);
        setWarnings(res.warnings ?? []);
        return;
      }
      const events = res.events ?? [];
      setRows(
        events.map((ev, i) => ({
          ...ev,
          time: ev.time ?? null,
          description: ev.description ?? null,
          key: i,
          include: true,
        })),
      );
      setNextKey(events.length);
      setWarnings(res.warnings ?? []);
    } catch {
      setError("일정표를 읽는 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setExtracting(false);
    }
  }

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: number) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { key: nextKey, date: "", title: "", time: null, description: null, include: true },
    ]);
    setNextKey((k) => k + 1);
  }

  const included = rows.filter((r) => r.include);
  const ready = included.filter((r) => r.date !== "" && r.title.trim() !== "");

  async function onConfirm() {
    setError(undefined);
    if (ready.length === 0) {
      setError("등록할 일정이 없습니다. 날짜와 제목을 확인해주세요.");
      return;
    }
    if (ready.length < included.length) {
      setError("날짜 또는 제목이 비어 있는 행이 있습니다. 채우거나 체크를 해제해주세요.");
      return;
    }
    setSaving(true);
    try {
      const payload: ExtractedEvent[] = ready.map((r) => ({
        date: r.date,
        title: r.title.trim(),
        time: r.time && r.time !== "" ? r.time : null,
        description: r.description && r.description.trim() !== "" ? r.description.trim() : null,
      }));
      const res = await confirmImportedEvents(payload);
      if (res.error) {
        setError(res.error);
        return;
      }
      setResult(res);
    } catch {
      setError("등록 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  }

  // ── 결과 화면 ──
  if (result) {
    return (
      <div className="space-y-4">
        <div className="rounded-card border border-border/60 bg-white p-5 shadow-sm">
          <p className="text-lg font-bold text-ink">{result.inserted}건 추가됨</p>
          {result.skipped.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-ink">
                건너뛴 일정 {result.skipped.length}건
              </p>
              <ul className="mt-1 space-y-0.5 text-sm text-ink-muted">
                {result.skipped.map((s, i) => (
                  <li key={i}>
                    {s.title} — {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <Link
          href="/calendar"
          className="block w-full rounded-btn bg-sage py-3 text-center font-medium text-white shadow-sm transition hover:bg-sage-deep"
        >
          일정으로 가기
        </Link>
      </div>
    );
  }

  const inputCls =
    "w-full rounded border border-border bg-white px-1.5 py-1 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-sage";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onDownloadTemplate}
          className="rounded-btn border border-border bg-white px-4 py-2 text-sm text-ink shadow-sm transition hover:bg-card"
        >
          템플릿 다운로드
        </button>
        <label className="inline-block cursor-pointer rounded-btn border border-border bg-white px-4 py-2 text-sm text-ink shadow-sm transition hover:bg-card">
          {fileName ? "다른 파일 선택" : "일정표 파일 선택"}
          <input
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={onPickFile}
            disabled={extracting}
          />
        </label>
        {fileName && <span className="text-sm text-ink-muted">{fileName}</span>}
      </div>

      {extracting && (
        <div className="rounded-card border border-border/60 bg-white p-5 text-center shadow-sm">
          <p className="animate-pulse text-sm text-ink">
            일정표를 읽는 중… (자유 양식은 AI가 읽어 최대 1분 정도 걸릴 수 있어요)
          </p>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      {warnings.length > 0 && (
        <div>
          <p className="text-sm font-medium text-amber-700">알림 {warnings.length}건</p>
          <ul className="mt-1 space-y-0.5 text-sm text-ink-muted">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {rows.length > 0 && !extracting && (
        <>
          <p className="text-sm text-ink-muted">
            추출된 일정 {rows.length}건 · 등록 대상{" "}
            <span className="font-medium text-ink">{included.length}건</span>
            <br />
            내용을 확인하고 필요하면 수정한 뒤 등록하세요.
          </p>

          <div className="overflow-x-auto rounded-card border border-border/60 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-card text-ink-muted">
                  <th className="px-2 py-1.5 text-left font-medium">포함</th>
                  <th className="px-2 py-1.5 text-left font-medium">날짜</th>
                  <th className="px-2 py-1.5 text-left font-medium">시간</th>
                  <th className="px-2 py-1.5 text-left font-medium">제목</th>
                  <th className="px-2 py-1.5 text-left font-medium">설명</th>
                  <th className="px-2 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.key}
                    className={`border-b border-border/40 last:border-0 ${r.include ? "" : "opacity-50"}`}
                  >
                    <td className="px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={r.include}
                        onChange={(e) => updateRow(r.key, { include: e.target.checked })}
                        className="h-4 w-4 accent-sage"
                        aria-label="포함"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="date"
                        value={r.date}
                        onChange={(e) => updateRow(r.key, { date: e.target.value })}
                        className={`${inputCls} min-w-[8.5rem]`}
                        aria-label="날짜"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="time"
                        value={r.time ?? ""}
                        onChange={(e) => updateRow(r.key, { time: e.target.value || null })}
                        className={`${inputCls} min-w-[6rem]`}
                        aria-label="시간"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={r.title}
                        onChange={(e) => updateRow(r.key, { title: e.target.value })}
                        className={`${inputCls} min-w-[10rem]`}
                        placeholder="일정 제목"
                        aria-label="제목"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={r.description ?? ""}
                        onChange={(e) =>
                          updateRow(r.key, { description: e.target.value || null })
                        }
                        className={`${inputCls} min-w-[12rem]`}
                        placeholder="(선택)"
                        aria-label="설명"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => removeRow(r.key)}
                        className="text-ink-muted transition hover:text-danger"
                        aria-label="행 삭제"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={addRow}
            className="rounded-btn border border-border bg-white px-4 py-2 text-sm text-ink shadow-sm transition hover:bg-card"
          >
            + 행 추가
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={saving || included.length === 0}
            className="w-full rounded-btn bg-sage py-3 font-medium text-white shadow-sm transition hover:bg-sage-deep disabled:opacity-50"
          >
            {saving ? "등록 중…" : `${included.length}건 일정 등록`}
          </button>
        </>
      )}
    </div>
  );
}
