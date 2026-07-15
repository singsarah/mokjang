import { z } from "zod";

// "YYYY-MM-DD"가 실제 존재하는 날짜인지 확인 (예: 2026-02-30 거부).
export function isRealDate(s: string): boolean {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  );
}

export const eventSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "제목을 입력해주세요")
    .max(100, "제목은 100자 이내로 입력해주세요"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜를 선택해주세요")
    .refine(isRealDate, "올바른 날짜가 아닙니다"),
  // 빈 문자열이면 "시간 없음"으로 취급 (서버 액션에서 null 변환).
  time: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(v),
      "시간은 HH:MM 형식으로 입력해주세요",
    )
    .optional()
    .default(""),
  description: z
    .string()
    .trim()
    .max(500, "설명은 500자 이내로 입력해주세요")
    .optional()
    .default(""),
});

export type EventInput = z.input<typeof eventSchema>;
export type EventParsed = z.output<typeof eventSchema>;
