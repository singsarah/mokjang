// 체험(demo) 모드 식별 — 순수 함수만 (클라이언트/서버 어디서나 import 가능).
// 체험 계정 이메일: demo-<타임스탬프>-<난수>@example.test
// 테스트 cleanup(test- 접두사)과 겹치지 않게 접두사를 분리한다.

export const DEMO_EMAIL_PREFIX = "demo-";
export const DEMO_EMAIL_DOMAIN = "@example.test";

export function isDemoEmail(email: string | null | undefined): boolean {
  return (
    !!email &&
    email.startsWith(DEMO_EMAIL_PREFIX) &&
    email.endsWith(DEMO_EMAIL_DOMAIN)
  );
}
