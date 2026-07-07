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
                    {meta(s.grade, s.school) && <span className="ml-1 text-xs text-ink-muted">{meta(s.grade, s.school)}</span>}
                  </span>
                </span>
                <button onClick={() => onRemove(s.id)} disabled={isPending} className="rounded-btn border border-border px-3 py-1 text-xs text-ink-muted transition hover:text-ink disabled:opacity-50">
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
            <ul className="space-y-2">
              {candidates.map((s) => (
                <li key={s.id}>
                  <label className={`flex items-center gap-3 rounded-card border border-border/60 p-3 shadow-sm ${s.currentClassName ? "bg-gray-300" : "bg-white"}`}>
                    <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="h-4 w-4" />
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${genderDot(s.gender)}`} />
                    <span className="text-ink">{s.name}
                      {meta(s.grade, s.school) && <span className="ml-1 text-xs text-ink-muted">{meta(s.grade, s.school)}</span>}
                    </span>
                    <span className="ml-auto text-xs text-ink-muted">
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
