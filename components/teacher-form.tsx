"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createTeacher, updateTeacher } from "@/app/actions/teachers";

type Initial = {
  name: string;
  birthdayMonth: number | null;
  birthdayDay: number | null;
  birthdayYear: number | null;
  phone: string | null;
  kakaoId: string | null;
  duty: string | null;
  jobType: string | null;
  note: string | null;
};

export function TeacherForm({
  initial,
  teacherId,
}: {
  initial?: Initial;
  teacherId?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(undefined);
    const payload = {
      name: String(formData.get("name") ?? ""),
      birthdayMonth: formData.get("birthdayMonth") ? Number(formData.get("birthdayMonth")) : null,
      birthdayDay: formData.get("birthdayDay") ? Number(formData.get("birthdayDay")) : null,
      birthdayYear: formData.get("birthdayYear") ? Number(formData.get("birthdayYear")) : null,
      phone: (formData.get("phone") as string) || null,
      kakaoId: (formData.get("kakaoId") as string) || null,
      duty: (formData.get("duty") as string) || null,
      jobType: (formData.get("jobType") as string) || null,
      note: (formData.get("note") as string) || null,
    };
    startTransition(async () => {
      const result = teacherId
        ? await updateTeacher({ id: teacherId, ...payload })
        : await createTeacher(payload);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.push("/settings/teachers");
    });
  }

  const input =
    "mt-1 w-full rounded-btn border border-border bg-white px-3 py-2 text-ink";
  return (
    <form action={onSubmit} className="space-y-4">
      <label className="block">
        <span className="text-sm">이름 *</span>
        <input name="name" required defaultValue={initial?.name} className={input} />
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
        <span className="text-sm">전화번호</span>
        <input name="phone" defaultValue={initial?.phone ?? ""} className={input} />
      </label>
      <label className="block">
        <span className="text-sm">카카오톡 ID</span>
        <input name="kakaoId" defaultValue={initial?.kakaoId ?? ""} className={input} />
      </label>
      <label className="block">
        <span className="text-sm">담당</span>
        <input
          name="duty"
          defaultValue={initial?.duty ?? ""}
          placeholder="예: 찬양팀"
          className={input}
        />
      </label>
      <label className="block">
        <span className="text-sm">직장인/학생</span>
        <input
          name="jobType"
          defaultValue={initial?.jobType ?? ""}
          placeholder="예: 직장인, 학생, 기타"
          className={input}
        />
      </label>
      <label className="block">
        <span className="text-sm">비고</span>
        <textarea
          name="note"
          rows={3}
          defaultValue={initial?.note ?? ""}
          placeholder="교사에 대해 남길 메모를 자유롭게 적으세요"
          className={input}
        />
      </label>

      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-btn bg-sage py-3 font-medium text-white shadow-sm transition hover:bg-sage-deep disabled:opacity-50"
      >
        {isPending ? "저장 중..." : "저장"}
      </button>
    </form>
  );
}
