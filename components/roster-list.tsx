"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { bulkHideStudents, bulkGraduateStudents } from "@/app/actions/students";

export type RosterListItem = {
  id: string;
  name: string;
  gender: string | null;
  meta: string; // "1학년 · 학교 · 전화" 형태로 서버에서 조합
  isBirthdayMonth: boolean;
};
export type RosterListSection = { label: string; items: RosterListItem[] };

// 성별 색점: 여=핑크, 남=하늘, 미입력=중립(테두리만). 배정 목록과 동일.
function genderDot(gender: string | null): string {
  return gender === "female"
    ? "bg-pink-400"
    : gender === "male"
      ? "bg-sky-400"
      : "bg-transparent border border-border";
}

export function RosterList({
  sections,
  canEdit,
}: {
  sections: RosterListSection[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function runBulk(kind: "hide" | "graduate") {
    const ids = [...selected];
    if (ids.length === 0) return;
    const msg =
      kind === "hide"
        ? `선택한 ${ids.length}명을 숨김 처리할까요?\n(숨김 화면에서 언제든 복원할 수 있어요)`
        : `선택한 ${ids.length}명을 졸업 처리할까요?\n반 배정이 해제되고 졸업생 명단으로 이동합니다.\n(졸업생 화면에서 복원할 수 있어요)`;
    if (!confirm(msg)) return;
    setError(undefined);
    startTransition(async () => {
      const result =
        kind === "hide"
          ? await bulkHideStudents({ ids })
          : await bulkGraduateStudents({ ids });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <>
      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      {sections.map((sec) => (
        <section key={sec.label} className="mt-7">
          <h2 className="mb-2 text-sm font-bold text-ink-muted">{sec.label}</h2>
          <ul className="space-y-2">
            {sec.items.map((s) => (
              <li key={s.id} className="flex items-center gap-2">
                {canEdit && (
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => toggle(s.id)}
                    aria-label={`${s.name} 선택`}
                    className="h-5 w-5 shrink-0 accent-sage-deep"
                  />
                )}
                <Link
                  href={`/settings/roster/${s.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-card border border-border/60 bg-white p-3 shadow-sm transition hover:shadow-md"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sky-soft">
                    <Icon name="sheep-face" size={30} alt="양" />
                  </span>
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="flex shrink-0 items-center gap-1.5 font-medium text-ink">
                      <span
                        className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${genderDot(s.gender)}`}
                      />
                      {s.name}
                      {s.isBirthdayMonth && (
                        <Icon name="star" size={14} alt="이번 달 생일" />
                      )}
                    </span>
                    {s.meta && (
                      <span className="truncate text-sm text-ink-muted">{s.meta}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-lg text-ink-muted">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {/* 선택 시 하단 탭바 위로 뜨는 일괄 처리 바 */}
      {canEdit && selected.size > 0 && (
        <div className="fixed bottom-20 left-0 right-0 z-40 px-4">
          <div className="mx-auto flex max-w-md items-center gap-2 rounded-card border border-border bg-white p-2 shadow-lg">
            <span className="min-w-0 flex-1 truncate pl-2 text-sm font-medium text-ink">
              {selected.size}명 선택
            </span>
            <button
              onClick={() => runBulk("hide")}
              disabled={isPending}
              className="shrink-0 rounded-btn border border-border bg-white px-3 py-1.5 text-sm text-ink transition hover:bg-card disabled:opacity-50"
            >
              숨김
            </button>
            <button
              onClick={() => runBulk("graduate")}
              disabled={isPending}
              className="shrink-0 rounded-btn bg-gold px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-gold-deep hover:text-white disabled:opacity-50"
            >
              졸업 처리
            </button>
            <button
              onClick={() => setSelected(new Set())}
              disabled={isPending}
              aria-label="선택 취소"
              title="선택 취소"
              className="shrink-0 rounded-btn px-2 py-1.5 text-sm text-ink-muted transition hover:text-ink disabled:opacity-50"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
