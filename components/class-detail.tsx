"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateClass, assignStudents, deleteClass } from "@/app/actions/classes";
import { Icon } from "@/components/icon";

type Member = { id: string; name: string; grade: number | null; school: string | null; gender: string | null };
type Candidate = {
  id: string;
  name: string;
  grade: number | null;
  school: string | null;
  gender: string | null;
  currentClassName: string | null;
};

export function ClassDetail({
  classId,
  className,
  teacherName,
  members,
  candidates,
  canDelete,
}: {
  classId: string;
  className: string;
  teacherName: string | null;
  members: Member[];
  candidates: Candidate[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [gradeFilter, setGradeFilter] = useState<number | null>(null); // null = 전체
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function run(action: Promise<{ error?: string }>, after?: () => void) {
    setError(undefined);
    startTransition(async () => {
      const result = await action;
      if (result?.error) {
        setError(result.error);
        return;
      }
      after?.();
      router.refresh();
    });
  }

  function onSaveInfo(formData: FormData) {
    run(
      updateClass({
        id: classId,
        name: String(formData.get("name") ?? ""),
        teacherName: (formData.get("teacherName") as string) || null,
      }),
    );
  }

  function onAdd() {
    if (selected.size === 0) return;
    run(assignStudents({ studentIds: [...selected], classId }), () => setSelected(new Set()));
  }

  function onRemove(studentId: string) {
    run(assignStudents({ studentIds: [studentId], classId: null }));
  }

  function onDelete() {
    run(deleteClass({ id: classId }), () => router.push("/settings/roster/classes"));
  }

  const input = "mt-1 w-full rounded-btn border border-border bg-white px-3 py-2 text-ink";
  const genderDot = (gender: string | null) =>
    gender === "female" ? "bg-pink-400" : gender === "male" ? "bg-sky-400" : "bg-transparent border border-border";
  const meta = (grade: number | null, school: string | null) =>
    [grade ? `${grade}학년` : null, school].filter(Boolean).join(" · ");
  const query = search.trim();
  const shownCandidates = candidates.filter(
    (s) =>
      (gradeFilter === null || s.grade === gradeFilter) &&
      (query === "" || s.name.includes(query)),
  );
  return (
    <div className="space-y-8">
      {/* 반 정보 수정 */}
      <form action={onSaveInfo} className="space-y-3 rounded-card border border-border/60 bg-white p-4 shadow-sm">
        <h2 className="font-bold text-ink">반 정보</h2>
        <label className="block">
          <span className="text-sm text-ink-muted">반 이름</span>
          <input name="name" required defaultValue={className} className={input} />
        </label>
        <label className="block">
          <span className="text-sm text-ink-muted">선생님 (선택)</span>
          <input name="teacherName" defaultValue={teacherName ?? ""} placeholder="선생님 이름" className={input} />
        </label>
        <button type="submit" disabled={isPending} className="w-full rounded-btn bg-sage py-2 font-medium text-white shadow-sm transition hover:bg-sage-deep disabled:opacity-50">
          {isPending ? "저장 중..." : "저장"}
        </button>
      </form>

      {error && <p className="text-sm text-danger">{error}</p>}

      {/* 이 반 학생 */}
      <section>
        <h2 className="mb-2 font-bold text-ink">이 반 학생 ({members.length})</h2>
        {members.length === 0 ? (
          <p className="text-sm text-ink-muted">아직 이 반에 학생이 없어요.</p>
        ) : (
          <ul className="space-y-2">
            {members.map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded-card border border-border/60 bg-white p-3 shadow-sm">
                <span className="flex items-center gap-2">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${genderDot(s.gender)}`} />
                  <span className="flex items-center gap-1 text-ink"><Icon name="sheep-face" size={16} alt="" />{s.name}
                    {meta(s.grade, s.school) && <span className="ml-1 text-sm text-ink-muted">{meta(s.grade, s.school)}</span>}
                  </span>
                </span>
                <button onClick={() => onRemove(s.id)} disabled={isPending} className="rounded-btn border border-border px-3 py-1 text-sm text-ink-muted transition hover:text-ink disabled:opacity-50">
                  빼기
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 학생 추가 */}
      <section>
        <h2 className="mb-2 font-bold text-ink">➕ 학생 추가</h2>
        {candidates.length === 0 ? (
          <p className="text-sm text-ink-muted">추가할 학생이 없어요.</p>
        ) : (
          <>
            {/* 이름 검색 — 학생이 많을 때 스크롤 대신 바로 찾기 */}
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름 검색"
              aria-label="학생 이름 검색"
              className="mb-2 w-full rounded-btn border border-border bg-white px-3 py-2 text-ink"
            />
            {/* 학년 필터 */}
            <div className="mb-3 flex gap-2">
              {([null, 1, 2, 3] as const).map((g) => (
                <button
                  key={g ?? "all"}
                  type="button"
                  onClick={() => setGradeFilter(g)}
                  className={`flex-1 rounded-btn px-3 py-1.5 text-sm transition ${
                    gradeFilter === g
                      ? "bg-sage-deep font-bold text-white"
                      : "border border-border bg-white text-ink-muted hover:text-ink"
                  }`}
                >
                  {g === null ? "전체" : `${g}학년`}
                </button>
              ))}
            </div>
            {shownCandidates.length === 0 && (
              <p className="py-2 text-center text-sm text-ink-muted">조건에 맞는 학생이 없어요.</p>
            )}
            <ul className="space-y-2">
              {shownCandidates.map((s) => (
                <li key={s.id}>
                  <label className={`flex items-center gap-3 rounded-card border border-border/60 p-3 shadow-sm ${s.currentClassName ? "bg-gray-300" : "bg-white"}`}>
                    <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="h-4 w-4" />
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${genderDot(s.gender)}`} />
                    <span className="text-ink">{s.name}
                      {meta(s.grade, s.school) && <span className="ml-1 text-sm text-ink-muted">{meta(s.grade, s.school)}</span>}
                    </span>
                    <span className="ml-auto text-sm text-ink-muted">
                      {s.currentClassName ? `현재: ${s.currentClassName}` : "미배정"}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <button onClick={onAdd} disabled={isPending || selected.size === 0} className="mt-3 w-full rounded-btn bg-sage py-2.5 font-medium text-white shadow-sm transition hover:bg-sage-deep disabled:opacity-50">
              선택한 {selected.size}명 이 반에 추가
            </button>
          </>
        )}
      </section>

      {/* 삭제 (빈 반만) */}
      {canDelete && (
        <button onClick={onDelete} disabled={isPending} className="w-full rounded-btn border border-danger py-2 text-sm text-danger transition hover:bg-unconfirmed-soft disabled:opacity-50">
          이 반 삭제
        </button>
      )}
    </div>
  );
}
