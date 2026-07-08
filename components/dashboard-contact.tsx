"use client";

import { useState } from "react";

type ContactEntry = {
  name: string;
  gender: string | null;
  grade: number;
  className: string | null;
  phoneSelf: string | null;
  phoneGuardian: string | null;
  guardianRelation: string | null;
};

// 성별 점 색 (dashboard-stats 관례와 동일)
const genderDot = (gender: string | null) =>
  gender === "female" ? "bg-pink-400" : gender === "male" ? "bg-sky-400" : "bg-transparent border border-border";

// 전화 링크용 번호 정규화
const telHref = (phone: string) => `tel:${phone.replace(/[^0-9+]/g, "")}`;

export function DashboardContact({ canCall, contact }: { canCall: boolean; contact: ContactEntry[] }) {
  // 여러 줄 동시에 펼침 허용 → index 집합
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (i: number) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <ul className="mt-3 divide-y divide-border">
      {contact.map((e, i) => {
        const isOpen = open.has(i);
        return (
          <li key={i}>
            {/* 줄 탭 → 연락처 펼침 */}
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => toggle(i)}
              className="flex w-full items-center justify-between gap-2 py-2 text-left"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${genderDot(e.gender)}`} />
                <span className="truncate text-sm text-ink">{e.name}</span>
              </span>
              <span className="shrink-0 text-xs text-ink-muted">
                {e.className ? `${e.grade}학년 · ${e.className}` : `${e.grade}학년`}
              </span>
            </button>

            {isOpen && (
              <div className="pb-2 pl-4 text-sm">
                {!e.phoneSelf && !e.phoneGuardian ? (
                  <p className="text-ink-muted">연락처가 없어요</p>
                ) : (
                  <div className="space-y-0.5">
                    {e.phoneSelf && (
                      <p className="text-ink">
                        <span className="text-ink-muted">본인 </span>
                        {canCall ? (
                          <a href={telHref(e.phoneSelf)} className="text-sky-600 underline">
                            {e.phoneSelf}
                          </a>
                        ) : (
                          <span>{e.phoneSelf}</span>
                        )}
                      </p>
                    )}
                    {e.phoneGuardian && (
                      <p className="text-ink">
                        <span className="text-ink-muted">
                          보호자{e.guardianRelation ? `(${e.guardianRelation})` : ""}{" "}
                        </span>
                        {canCall ? (
                          <a href={telHref(e.phoneGuardian)} className="text-sky-600 underline">
                            {e.phoneGuardian}
                          </a>
                        ) : (
                          <span>{e.phoneGuardian}</span>
                        )}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
