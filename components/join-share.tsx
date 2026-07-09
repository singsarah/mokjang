"use client";

import { useState } from "react";

// 참여 코드와 참여 링크를 함께 보여주고, 각각 복사 버튼을 제공한다.
export function JoinShare({ code, url }: { code: string; url: string }) {
  const [copied, setCopied] = useState<"" | "code" | "link">("");

  async function copy(text: string, which: "code" | "link") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      // 클립보드 접근 불가(구형 브라우저/비HTTPS) — 사용자가 길게 눌러 직접 복사 가능.
    }
  }

  return (
    <div>
      <div className="text-sm text-ink-muted">참여 코드</div>
      <div className="mt-1 flex items-center gap-2">
        <span className="select-all font-mono text-2xl font-bold tracking-widest text-sage-deep">
          {code}
        </span>
        <button
          type="button"
          onClick={() => copy(code, "code")}
          className="rounded-btn border border-border px-2 py-1 text-sm text-ink-muted hover:bg-card"
        >
          {copied === "code" ? "복사됨 ✓" : "복사"}
        </button>
      </div>

      {url && (
        <>
          <div className="mt-5 text-sm text-ink-muted">참여 링크</div>
          <div className="mt-1 flex items-center gap-2">
            <a
              href={url}
              className="select-all break-all text-sm text-sky-deep underline"
            >
              {url}
            </a>
            <button
              type="button"
              onClick={() => copy(url, "link")}
              className="shrink-0 rounded-btn border border-border px-2 py-1 text-sm text-ink-muted hover:bg-card"
            >
              {copied === "link" ? "복사됨 ✓" : "복사"}
            </button>
          </div>
        </>
      )}

      <p className="mt-3 text-sm text-ink-muted">
        코드나 링크를 다른 교사에게 공유하세요. 링크를 열면 참여 화면에 코드가
        자동으로 입력됩니다.
      </p>
    </div>
  );
}
