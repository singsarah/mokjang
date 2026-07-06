"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createStudent, updateStudent } from "@/app/actions/students";
import type { RosterClass } from "@/lib/students";
import type { StudentInput } from "@/lib/validation/student";

type Initial = {
  name: string;
  grade: number;
  classId: string | null;
  birthdayMonth: number | null;
  birthdayDay: number | null;
  birthdayYear: number | null;
  phoneSelf: string | null;
  phoneGuardian: string | null;
  guardianRelation: string | null;
};

export function StudentForm({
  classes,
  initial,
  studentId,
}: {
  classes: RosterClass[];
  initial?: Initial;
  studentId?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(undefined);
    const payload = {
      name: String(formData.get("name") ?? ""),
      grade: Number(formData.get("grade") ?? 1),
      classId: (formData.get("classId") as string) || null,
      birthdayMonth: formData.get("birthdayMonth") ? Number(formData.get("birthdayMonth")) : null,
      birthdayDay: formData.get("birthdayDay") ? Number(formData.get("birthdayDay")) : null,
      birthdayYear: formData.get("birthdayYear") ? Number(formData.get("birthdayYear")) : null,
      phoneSelf: (formData.get("phoneSelf") as string) || null,
      phoneGuardian: (formData.get("phoneGuardian") as string) || null,
      guardianRelation: (((formData.get("guardianRelation") as string) ||
        null) as StudentInput["guardianRelation"]),
    };
    startTransition(async () => {
      const result = studentId
        ? await updateStudent({ id: studentId, ...payload })
        : await createStudent(payload);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.push("/settings/roster");
    });
  }

  const input = "mt-1 w-full rounded-md border px-3 py-2";
  return (
    <form action={onSubmit} className="space-y-4">
      <label className="block">
        <span className="text-sm">이름 *</span>
        <input name="name" required defaultValue={initial?.name} className={input} />
      </label>
      <label className="block">
        <span className="text-sm">학년 *</span>
        <input name="grade" type="number" min={1} max={6} required defaultValue={initial?.grade ?? 1} className={input} />
      </label>
      <label className="block">
        <span className="text-sm">반</span>
        <select name="classId" defaultValue={initial?.classId ?? ""} className={input}>
          <option value="">반 없음</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.grade}학년 {c.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-2">
        <label className="block flex-1">
          <span className="text-sm">생일 월</span>
          <input name="birthdayMonth" type="number" min={1} max={12} defaultValue={initial?.birthdayMonth ?? ""} className={input} />
        </label>
        <label className="block flex-1">
          <span className="text-sm">일</span>
          <input name="birthdayDay" type="number" min={1} max={31} defaultValue={initial?.birthdayDay ?? ""} className={input} />
        </label>
        <label className="block flex-1">
          <span className="text-sm">연(선택)</span>
          <input name="birthdayYear" type="number" defaultValue={initial?.birthdayYear ?? ""} className={input} />
        </label>
      </div>
      <label className="block">
        <span className="text-sm">본인 연락처</span>
        <input name="phoneSelf" defaultValue={initial?.phoneSelf ?? ""} className={input} />
      </label>
      <label className="block">
        <span className="text-sm">보호자 연락처</span>
        <input name="phoneGuardian" defaultValue={initial?.phoneGuardian ?? ""} className={input} />
      </label>
      <label className="block">
        <span className="text-sm">보호자 관계</span>
        <select name="guardianRelation" defaultValue={initial?.guardianRelation ?? ""} className={input}>
          <option value="">선택 안 함</option>
          <option value="모">모</option>
          <option value="부">부</option>
          <option value="기타">기타</option>
        </select>
      </label>
      {error && <p className="text-sm text-coral-500">{error}</p>}
      <button type="submit" disabled={isPending} className="w-full rounded-lg bg-pasture-500 py-3 text-white disabled:opacity-50">
        {isPending ? "저장 중..." : "저장"}
      </button>
    </form>
  );
}
