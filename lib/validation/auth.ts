import { z } from "zod";

// Zod v4 idioms: top-level `z.email()`, and `{ error }` for custom messages.
export const signUpSchema = z.object({
  email: z.email("이메일 형식이 맞지 않습니다"),
  password: z
    .string()
    .min(8, "비밀번호는 8자 이상이어야 합니다")
    .regex(/[A-Za-z]/, "영문 포함 필요")
    .regex(/[0-9]/, "숫자 포함 필요"),
  displayName: z
    .string()
    .min(1, "이름을 입력해주세요")
    .max(50, "이름이 너무 깁니다"),
  consent: z.literal(true, { error: "개인정보 처리 방침에 동의해주세요" }),
});

export const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
