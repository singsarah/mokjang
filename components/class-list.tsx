"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkDeleteClasses } from "@/app/actions/classes";

export type ClassListItem = {
  id: string;
  name: string;
  teacherName: string | null;
  count: number; // 배정된 학생 수
};

// 반 관리 목록 — 체크박스로 여러 반을 골라 한 번에 삭제.
// 선택하면 목록 위에 삭제 바가 나타난다 (학적부 일괄 처리와 같은 패턴).
export function ClassList({ classes }: { classes: ClassListItem[] }) {
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

  function onDelete() {
    const ids = [...selected];
    if (ids.length === 0) return;
    const names = classes
      .filter((c) => selected.has(c.id))
      .map((c) => c.name)
      .join(", ");
    const studentTotal = classes
      .filter((c) => selected.has(c.id))
      .reduce((n, c) => n + c.count, 0);
    const msg =
      studentTotal > 0
        ? `${names}\n반 ${ids.length}개를 삭제할까요?\n반에 있던 학생 ${studentTotal}명은 미배정으로 이동합니다. (학생은 삭제되지 않아요)`
        : `${names}\n반 ${ids.length}개를 삭제할까요?`;
    if (!confirm(msg)) return;
    setError(undefined);
    startTransition(async () => {
      const result = await bulkDeleteClasses({ ids });
      if (result?.error) {
        setError("삭제에 실패했어요. 다시 시도해주세요.");
        return;
      }
      setSelected(new Set());
      router.refresh();
    });
  }

  if (classes.length === 0) {
    return (
      <p className="mt-8 text-center text-ink-muted">
        아직 반이 없어요. (반 없이도 사용 가능)
      </p>
    );
  }

  return (
    <>
      {/* 선택하면 목록 위에 나타나는 삭제 바 */}
      {selected.size > 0 && (
        <div className="mt-6 flex items-center gap-2 rounded-card border border-border bg-white p-2 shadow-sm">
          <span className="min-w-0 flex-1 truncate pl-2 text-sm font-medium text-ink">
            반 {selected.size}개 선택
          </span>
          <button
            onClick={onDelete}
            disabled={isPending}
            className="shrink-0 rounded-btn border border-danger px-3 py-1.5 text-sm font-medium text-danger transition hover:bg-unconfirmed-soft disabled:opacity-50"
          >
            {isPending ? "삭제 중…" : "선택한 반 삭제"}
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
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      <ul className={`${selected.size > 0 ? "mt-3" : "mt-8"} space-y-2`}>
        {classes.map((c) => (
          <li key={c.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selected.has(c.id)}
              onChange={() => toggle(c.id)}
              aria-label={`${c.name} 선택`}
              className="h-5 w-5 shrink-0 accent-sage-deep"
            />
            <Link
              href={`/settings/roster/classes/${c.id}`}
              className="flex min-w-0 flex-1 items-center justify-between rounded-card border border-border/60 bg-white p-3 shadow-sm transition hover:shadow-md"
            >
              <span className="min-w-0 truncate text-ink">
                {c.name}
                {c.teacherName && (
                  <span className="text-sm text-ink-muted"> · {c.teacherName} 선생님</span>
                )}{" "}
                <span className="text-sm text-ink-muted">({c.count}명)</span>
              </span>
              <span className="shrink-0 text-lg text-ink-muted">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
