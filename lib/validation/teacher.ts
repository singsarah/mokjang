import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullish()
  .transform((v) => v ?? null);

const optionalInt = (min: number, max: number) =>
  z.coerce.number().int().min(min).max(max).nullish().transform((v) => v ?? null);

export const teacherSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해주세요").max(50),
  birthdayMonth: optionalInt(1, 12),
  birthdayDay: optionalInt(1, 31),
  birthdayYear: optionalInt(1900, 2100),
  phone: optionalText,
  kakaoId: optionalText,
  duty: optionalText, // 담당 (예: 찬양팀)
  jobType: optionalText, // 직장인/학생/기타 (자유텍스트)
  note: optionalText, // 비고
});

export type TeacherInput = z.infer<typeof teacherSchema>;
