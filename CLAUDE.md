# 목장 관리 (Mokjang) — 프로젝트 가이드

교회 고등부 출석·일정·생일·학적부 관리 **멀티테넌트 PWA**. 처음엔 한 고등부용, 이후 다른 그룹도 같은 인스턴스에 배포해 쓰도록 설계.

**진실의 원천(설계 결정):** `docs/superpowers/specs/2026-07-03-mokjang-design.md` — 확정된 결정은 여기 있음. 사용자가 재검토하지 않는 한 재논의하지 말 것. 구현 계획은 `docs/superpowers/plans/`.

---

## 스택 & 절대 규칙
- **Next.js 15 (App Router) + React 19 + Supabase**(Postgres + Auth + RLS + Storage), Tailwind, Zod, react-hook-form.
- 패키지 매니저는 **npm 고정** (pnpm/yarn ❌ — Windows 초보 친화). Node **20+** (로컬은 v24).
- 개발 포트는 **3100 고정** (`next dev -p 3100`). 모든 문서/URL/env가 3100 기준.
- UI 텍스트는 **한국어**. 사용자와의 대화도 기본 한국어.

## 명령어
```bash
npm run dev         # 개발 서버 (포트 3100)
npm run build       # 프로덕션 빌드
npm run typecheck   # tsc --noEmit
npm test            # vitest run (단위 + RLS 통합)
npm run test:e2e    # playwright test (자체 dev 서버 기동)
```
**출시 기준(shipping bar) — 태스크/플랜 완료 전 반드시 4개 다 통과:**
`npm run typecheck && npm test && npm run test:e2e && npm run build`

## Supabase 작업
- **네트워크가 필요한 명령(`npm test`, `test:e2e`, curl → *.supabase.co, `supabase db push`)은 샌드박스에서 차단됨** → `dangerouslyDisableSandbox: true` 로 실행.
- 마이그레이션 적용: `printf 'y\n' | npx supabase db push` (Docker/edge-runtime 캐시 경고는 무해).
- 새 마이그레이션 번호는 **항상 `npx supabase migration list --linked` 로 마지막 번호 확인 후 +1** (타임스탬프 충돌 주의).
- `supabase gen types typescript --linked` 는 **Management API 토큰이 없어 이 머신에서 실패**함 → 새 RPC/타입은 `lib/supabase/database.types.ts` 를 **손으로 수정**하거나 사용자가 토큰 제공.
- `supabase login`/`link` 는 TTY 필요 → 사용자가 자기 터미널에서 실행 (dev는 이미 완료).
- **모든 `SECURITY DEFINER` 함수는 `SET search_path = ''` + 스키마 정규화(`public.foo`) 필수** (안 그러면 `supabase_auth_admin` 컨텍스트에서 깨짐 → 마이그레이션 000003 참고).

## ⚠️ 치명적 함정 (반복해서 물렸던 것들)
1. **dev 서버가 켜진 채 `npm run build` 하면 dev의 `.next` 가 오염됨** → 클라이언트 청크 404 → **하이드레이션 실패 → 폼이 조용히 아무 동작도 안 함**(폼 버그처럼 보임). build 전에 dev를 반드시 끄고, 복구는 `rm -rf .next`. E2E는 Playwright가 서버를 소유하게 두고 동시에 build 금지.
2. **dev 서버를 죽여도 자식 `next dev` 가 포트 3100 을 계속 점유**하는 경우가 있음. build/재기동 전 확인:
   `Get-NetTCPConnection -LocalPort 3100 -State Listen` → `Stop-Process -Id <pid> -Force`.
3. **Playwright 폼 제출은 절대 단일 `.click()` 금지** — dev에서 하이드레이션과 경쟁해 no-op(요청 0건)이 됨. `tests/e2e/helpers.ts` 의 `submitUntilUrl` 또는 `expect(async()=>{…}).toPass()` 패턴으로 **효과가 날 때까지 재시도**. (E2E 검증 assertion도 버튼 텍스트가 아니라 결과 상태로 확인할 것.)
4. **`memberships` 에 `profiles` 를 PostgREST embed 불가** — 둘 다 `auth.users` 를 FK로 가리켜 직접 관계가 없음. `.select("...profiles(...)")` 는 타입·런타임 모두 실패. 멤버십을 먼저 조회 → `profiles.in("id", userIds)` 로 따로 가져와 JS Map으로 조인.
5. **`audit_log` 는 유저 INSERT RLS 정책이 없음(의도)** → 감사 로그는 `lib/supabase/service.ts` 의 서비스롤 클라이언트로만 기록.
6. Bash 도구의 `curl -d '{...}'` 본문에 **한글을 넣으면 Git-Bash 인코딩으로 JSON이 깨짐**(`PGRST102`). 테스트 데이터는 ASCII를 쓰거나 파일로 써서 `curl -d @file`.

## 코드 구조
- `app/(auth)` 로그인·가입 · `app/(onboarding)` new-group/join/pending · `app/(app)` 로그인 후 탭(attendance/calendar/dashboard/settings) · `app/actions` 서버 액션 · `app/auth/callback` OAuth.
- `lib/supabase/`: `server.ts`(쿠키 기반 유저 클라이언트) · `client.ts`(브라우저) · `service.ts`(서비스롤, RLS 우회 — 감사 로그 등 서버 전용) · `middleware.ts` · `database.types.ts`.
- `lib/memberships.ts` `requireCurrentMembership()` = 현재 활성/대기 멤버십 로드 후 상태별 리다이렉트(`/join` `/pending`). `lib/constants.ts` 역할/상태 enum + 한국어 라벨.
- 멤버십 변경 등 사용자 행위는 **RLS 적용 유저 클라이언트**로, 감사 로그만 서비스롤로.

## 테스트
- **전용 테스트 프로젝트 없음** — 무료 티어라 RLS 통합 테스트도 `mokjang-dev` 프로젝트에 실행. `tests/integration/setup.ts` 의 `cleanup()` 은 **`test-…@example.test` 유저와 그들이 만든 그룹만** 삭제하므로 실제 데이터는 건드리지 않음.
- E2E 테스트 유저 이메일은 `<prefix>-<timestamp>@example.test` (`tests/e2e/helpers.ts`).
- `.env.local`(gitignored)에 실제 Supabase 값. `TEST_SUPABASE_*` 가 있으면 우선, 없으면 dev 값으로 폴백.

## 아키텍처 원칙 (재논의 금지 — 설계 확정)
- **단일 Supabase 프로젝트 멀티테넌트**: 모든 테넌트 테이블에 `group_id` + RLS. `groups` = 테넌트. 무료 티어 프로젝트 제한 때문에 전체 앱이 한 프로젝트에서 동작. 특정 그룹이 완전 분리를 원하면 같은 마이그레이션을 새 프로젝트에 배포하고 그 배포의 env URL만 교체.
- 배포(GitHub/Vercel/Supabase)는 `DEPLOY.md` 참고 — **사용자 계정으로 진행하는 별도 수동 단계**.

## 진행 상황
- **main = 배포 브랜치** (push → Vercel 자동 배포, mokjang-eight.vercel.app). Plan 1~6 전부 병합·배포 완료, 이후 기능은 플랜 문서 없이 세션 단위로 개발·배포 중.
- **현재 구현 현황 + 미구현 백로그는 설계 문서(`docs/superpowers/specs/2026-07-03-mokjang-design.md`, 2026-07-18 전면 개정) §1~§9 / §10 참고.** 기능이 바뀌면 같은 커밋에서 이 문서도 갱신할 것.
