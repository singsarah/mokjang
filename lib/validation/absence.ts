import { z } from "zod";
import { isRealDate } from "./event";

export const absenceSchema = z
  .object({
    teacherId: z.string().uuid("교사를 선택해주세요"),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "시작일을 선택해주세요")
      .refine(isRealDate, "올바른 날짜가 아닙니다"),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "종료일을 선택해주세요")
      .refine(isRealDate, "올바른 날짜가 아닙니다"),
    reason: z
      .string()
      .trim()
      .max(100, "사유는 100자 이내로 입력해주세요")
      .optional()
      .default(""),
  })
  .refine((d) => d.startDate <= d.endDate, {
    message: "종료일은 시작일보다 빠를 수 없어요",
    path: ["endDate"],
  });

export type AbsenceInput = z.input<typeof absenceSchema>;
export type AbsenceParsed = z.output<typeof absenceSchema>;
