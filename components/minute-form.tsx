"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createMinute, updateMinute } from "@/app/actions/minutes";

type Initial = {
  title: string;
  date: string; // YYYY-MM-DD
  content: string;
};

export function MinuteForm({
  initial,
  minuteId,
  defaultDate,
}: {
  initial?: Initial;
  minuteId?: string;
  defaultDate: string; // 새 회의록의 기본 날짜(서버에서 KST 오늘 계산)
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(undefined);
    const payload = {
      title: String(formData.get("title") ?? ""),
      date: String(formData.get("date") ?? ""),
      content: String(formData.get("content") ?? ""),
    };
    startTransition(async () => {
      const result = minuteId
        ? await updateMinute({ id: minuteId, ...payload })
        : await createMinute(payload);
      if (result?.error) {
        setError(result.error);
        return;
      }
      // 수정이면 상세로, 새 작성이면 목록으로.
      router.push(minuteId ? `/minutes/${minuteId}` : "/minutes");
    });
  }

  const input =
    "mt-1 w-full rounded-btn border border-border bg-white px-3 py-2 text-ink";
  return (
    <form action={onSubmit} className="space-y-4">
      <label className="block">
        <span className="text-sm">회의 날짜 *</span>
        <input
          name="date"
          type="date"
          required
          defaultValue={initial?.date ?? defaultDate}
          className={input}
        />
      </label>
      <label className="block">
        <span className="text-sm">제목 *</span>
        <input
          name="title"
          required
          defaultValue={initial?.title}
          placeholder="예: 7월 교사회의"
          className={input}
        />
      </label>
      <label className="block">
        <span className="text-sm">내용</span>
        <textarea
          name="content"
          rows={14}
          defaultValue={initial?.content ?? ""}
          placeholder={"참석자, 안건, 결정사항 등을 자유롭게 적으세요"}
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
