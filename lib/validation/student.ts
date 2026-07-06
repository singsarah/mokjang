import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullish()
  .transform((v) => v ?? null);

const optionalInt = (min: number, max: number) =>
  z.coerce.number().int().min(min).max(max).nullish().transform((v) => v ?? null);

export const studentSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해주세요").max(50),
  grade: z.coerce.number().int().min(1, "학년을 선택해주세요").max(6),
  classId: z.string().uuid().nullish().transform((v) => v ?? null),
  birthdayMonth: optionalInt(1, 12),
  birthdayDay: optionalInt(1, 31),
  birthdayYear: optionalInt(1900, 2100),
  phoneSelf: optionalText,
  phoneGuardian: optionalText,
  guardianRelation: z.enum(["모", "부", "기타"]).nullish().transform((v) => v ?? null),
});

export type StudentInput = z.infer<typeof studentSchema>;

export const classSchema = z.object({
  grade: z.coerce.number().int().min(1).max(6),
  name: z.string().trim().min(1, "반 이름을 입력해주세요").max(30),
});

export type ClassInput = z.infer<typeof classSchema>;
