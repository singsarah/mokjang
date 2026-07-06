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
  grade: optionalInt(1, 6), // 학년은 선택(반 중심 편성)
  classId: z.string().uuid().nullish().transform((v) => v ?? null),
  birthdayMonth: optionalInt(1, 12),
  birthdayDay: optionalInt(1, 31),
  birthdayYear: optionalInt(1900, 2100),
  phoneSelf: optionalText,
  phoneGuardian: optionalText,
  guardianRelation: z.enum(["모", "부", "기타"]).nullish().transform((v) => v ?? null),
  guardianRelationOther: optionalText, // 관계가 '기타'일 때 상세
  school: optionalText, // 학교
  note: optionalText, // 선생님 자유 메모
  photoPath: optionalText, // Storage 내 사진 경로 (<group_id>/<uuid>)
});

export type StudentInput = z.infer<typeof studentSchema>;

export const classSchema = z.object({
  name: z.string().trim().min(1, "반 이름을 입력해주세요").max(30),
  teacherName: optionalText, // 반 담당 선생님 이름
});

export type ClassInput = z.infer<typeof classSchema>;
