import { z } from "zod";

// "YYYY-MM-DD"가 실제 존재하는 날짜인지 확인 (예: 2026-02-30 거부).
function isRealDate(s: string): boolean {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  );
}

export const minuteSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "제목을 입력해주세요")
    .max(100, "제목은 100자 이내로 입력해주세요"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜를 선택해주세요")
    .refine(isRealDate, "올바른 날짜가 아닙니다"),
  // 회의 본문 — 자유 형식 긴 글 (참석자·안건 등은 자유롭게 기재).
  content: z
    .string()
    .max(20000, "내용은 20,000자 이내로 입력해주세요")
    .optional()
    .default(""),
});

export type MinuteInput = z.input<typeof minuteSchema>;
export type MinuteParsed = z.output<typeof minuteSchema>;
