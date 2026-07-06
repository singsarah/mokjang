# 배포 가이드

> 코드·설정은 모두 준비돼 있습니다. 아래는 Sarah가 직접 계정에서 진행하는 수동 단계예요.

## 1. GitHub에 푸시

```bash
gh repo create mokjang --private --source=. --push
```

또는 GitHub 웹에서 새 저장소를 만들고:

```bash
git remote add origin https://github.com/YOUR_USERNAME/mokjang.git
git push -u origin main
```

## 2. Vercel 연동

1. https://vercel.com 로그인 → New Project → GitHub 저장소 선택
2. Framework: Next.js (자동 감지)
3. Environment Variables (`.env.local` 값 그대로):
   - `NEXT_PUBLIC_SUPABASE_URL` — Supabase 프로젝트 URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon public 키
   - `SUPABASE_SERVICE_ROLE_KEY` — service role 시크릿 (⚠️ Sensitive 체크)
   - `NEXT_PUBLIC_APP_URL` — Vercel 프로덕션 도메인 (예: https://mokjang.vercel.app)
4. Deploy 클릭

## 3. Supabase 리다이렉트 URL 추가

Supabase 대시보드 → Authentication → URL Configuration:

- Site URL: Vercel 프로덕션 도메인
- Redirect URLs:
  - `https://<vercel-도메인>.vercel.app/**`
  - `http://localhost:3100/**` (dev — 유지)

## 4. Google OAuth 리다이렉트 URI 확인

Google Cloud Console → Credentials → OAuth Client → Authorized redirect URIs:

- `https://fjgdxugsostlzdbrijyk.supabase.co/auth/v1/callback`

(Supabase 콜백 URL은 그대로 유지 — 도메인이 바뀌어도 이 값은 안 바꿔도 됩니다.)

## 5. 배포 확인

Vercel 프로덕션 URL 접속 → 회원가입/구글 로그인 → 그룹 생성 흐름 테스트.

## 프로덕션 데이터 이관 (선택)

지금은 dev Supabase 프로젝트(`fjgdxugsostlzdbrijyk`)를 그대로 써도 됩니다. 나중에 별도 프로덕션 프로젝트를 만들려면 같은 마이그레이션을 다시 적용:

```bash
npx supabase link --project-ref <prod-project-ref>
npx supabase db push
```

그리고 Vercel 환경변수를 프로덕션 프로젝트 값으로 교체하세요.
