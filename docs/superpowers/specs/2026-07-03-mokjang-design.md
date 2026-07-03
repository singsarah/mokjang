# 목장 관리 앱 — 설계 문서

- 작성일: 2026-07-03
- 원본 스펙: `c:\Users\Sarah\Downloads\목장관리_앱_스펙.md`
- 상태: 초안 (사용자 검토 대기)

## 0. 요약

교회 고등부 출석·일정·생일·학적부 관리 웹앱. 처음엔 우리 고등부용, 이후 다른 그룹도 쓸 수 있게 멀티테넌트로 배포.
모바일 우선 PWA + Next.js + Supabase(Postgres + Auth + RLS + Storage) 스택.

## 1. 확정된 결정 사항

| 항목 | 결정 |
|---|---|
| 기술 스택 | Next.js 15 (App Router) + Supabase |
| 배포 | Vercel + Supabase 클라우드 |
| UI | Tailwind + shadcn/ui, Pretendard 폰트, 파스텔 목장 테마 |
| 기기 | 모바일 우선, PWA 설치 가능 |
| 인증 | 이메일+비번 + 구글 OAuth (Supabase Auth) |
| 권한 | 마스터 · 편집 교사 · 조회 교사 (3역할) |
| 학적부 필드 | 이름 · 학년 · 반 · 생일 월/일 (연도 선택) · 본인 연락처 · 보호자 연락처 · 보호자 관계 |
| 반 구조 | 학년 → 반 → 학생 (반은 그룹별로 0~여러 개, 소규모는 반 없이 사용 가능) |
| 학생 입력 | 엑셀 대량 업로드 (신규 등록 + 학기 중 반 재편성 겸용) + 수동 추가·수정·삭제 |
| 내보내기 상세 | 하나의 xlsx에 3개 시트 (요약 · 학생별 누적 · **원본 raw**) |
| 알림 | 아침 이메일 다이제스트 + 앱 내 배너 + PWA 푸시 |
| 진급 | 매년 수동 '진급 실행' 버튼, 24시간 되돌리기 |
| 그룹 | 마스터가 생성 → 자동 8자리 코드 발급, 재발급 가능 |
| 출석 색상 | 3단계 (출석 초록 · 사유입력 노랑 · 미확인 산호색) |
| 일정 자동 추출 | PDF·이미지 OCR → 사람 검수 후 확정 |
| 내보내기 | 엑셀(.xlsx) |
| 개인정보 | 가입 동의 + 탈퇴 시 삭제 + 정책 페이지 |

## 2. 아키텍처

```
┌────────────────────────────┐         ┌───────────────────────────┐
│  Next.js 15 (App Router)   │         │  Supabase                 │
│  · React 서버 컴포넌트     │◄──HTTPS─►  · Postgres + RLS         │
│  · Tailwind + shadcn/ui    │         │  · Auth (이메일+구글)     │
│  · PWA (next-pwa)          │         │  · Storage (일정표 업로드)│
│  · Vercel 배포             │         │  · Edge Functions         │
└─────────┬──────────────────┘         └────────┬──────────────────┘
          │  Web Push (VAPID)                   │  pg_cron
          ▼                                     ▼
     PWA 알림                          매일 아침 6시 다이제스트
                                       (Edge Function → SendGrid)
```

### 멀티테넌시 원칙
- 모든 테넌트 데이터 테이블에 `group_id uuid NOT NULL` + RLS 정책
- 유저는 여러 그룹 소속 가능(미래 대비). 현재 활성 그룹은 세션 상태로 관리
- 그룹 간 격리는 DB 레벨에서 강제 — 앱 버그가 있어도 다른 그룹 데이터 못 봄

### PWA
- `manifest.json` + Service Worker
- 오프라인 지원은 최소 (읽기 캐시만) — 출석 체크는 온라인 전제
- iOS 16.4+ 안내: PWA 설치 후에만 푸시 알림 수신 가능

## 3. 데이터 모델 (Postgres)

### 핵심 테이블

```sql
-- 그룹 (테넌트)
groups (
  id uuid PK,
  name text NOT NULL,
  join_code text UNIQUE NOT NULL,  -- 8자리, 재발급 가능
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now()
)

-- 프로필 (auth.users 확장)
profiles (
  id uuid PK REFERENCES auth.users,
  display_name text,
  email text,
  avatar_url text,
  birthday_month int,  -- 교사 생일 알림
  birthday_day int,
  created_at timestamptz
)

-- 소속 (교사 목록 겸 권한)
memberships (
  id uuid PK,
  group_id uuid FK,
  user_id uuid FK,
  role text CHECK (role IN ('master','editor','viewer')),
  status text CHECK (status IN ('pending','active','removed')),
  invited_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  removed_at timestamptz,
  UNIQUE(group_id, user_id)
)

-- 반
classes (
  id uuid PK,
  group_id uuid FK,
  grade int NOT NULL,
  name text NOT NULL,     -- '1-1', '믿음반' 등
  display_order int,
  UNIQUE(group_id, grade, name)
)

-- 학생
students (
  id uuid PK,
  group_id uuid FK,
  class_id uuid FK NULL,  -- 반 없는 소규모 그룹은 NULL
  name text NOT NULL,
  grade int NOT NULL,     -- 반과 일관성은 애플리케이션에서 보장
  birthday_month int,
  birthday_day int,
  birthday_year int,
  phone_self text,
  phone_guardian text,
  guardian_relation text,  -- '모','부','기타'
  deleted_at timestamptz,  -- 소프트 삭제
  created_at timestamptz,
  updated_at timestamptz
)

-- 출석 세션 (그 날 하루)
attendance_sessions (
  id uuid PK,
  group_id uuid FK,
  session_date date NOT NULL,
  note text,  -- '주일예배', '수련회 1일차' 등
  created_by uuid,
  UNIQUE(group_id, session_date)
)

-- 출석 기록
attendance_records (
  id uuid PK,
  group_id uuid FK,
  session_id uuid FK,
  student_id uuid FK,
  status text CHECK (status IN ('present','absent_with_reason','unconfirmed')),
  reason text,
  updated_by uuid,
  updated_at timestamptz,
  UNIQUE(session_id, student_id)
)

-- 일정
calendar_events (
  id uuid PK,
  group_id uuid FK,
  title text NOT NULL,
  event_date date NOT NULL,
  event_time time,
  description text,
  source text CHECK (source IN ('manual','ocr')),
  created_by uuid,
  created_at timestamptz
)

-- 일정표 업로드 (OCR 검수)
calendar_uploads (
  id uuid PK,
  group_id uuid FK,
  storage_path text NOT NULL,
  status text CHECK (status IN ('processing','awaiting_review','confirmed','discarded')),
  extracted_events jsonb,
  uploaded_by uuid,
  created_at timestamptz
)

-- 푸시 구독
push_subscriptions (
  id uuid PK,
  user_id uuid FK,
  group_id uuid FK,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  device_label text
)

-- 진급 이력 (되돌리기용)
promotion_log (
  id uuid PK,
  group_id uuid FK,
  executed_at timestamptz,
  executed_by uuid,
  snapshot jsonb  -- 실행 전 각 학생 학년
)

-- 감사 로그
audit_log (
  id uuid PK,
  group_id uuid FK,
  actor_id uuid,
  action text,  -- 'student_deleted','teacher_removed','role_changed' 등
  target_id uuid,
  target_type text,
  metadata jsonb,
  created_at timestamptz
)
```

### RLS 정책 요지
- 모든 SELECT: `group_id IN (활성 멤버십 그룹)`
- INSERT/UPDATE/DELETE: 위 조건 + 역할 체크 (마스터/편집만 write, viewer는 read only)
- `students.phone_*` 필드: 조회 교사에게는 애플리케이션 레벨에서 마스킹 (010-***-1234)

### 인덱스
- `(group_id, session_date)` on attendance_sessions
- `(group_id, student_id)` on attendance_records
- `(group_id, deleted_at)` on students
- `(group_id, event_date)` on calendar_events

## 4. 주요 화면

### 하단 탭바 (모바일)
🐑 출석 · 📅 일정 · 📊 대시보드 · ⚙️ 설정

### 4.1 인증 · 온보딩
- `/login` — 이메일+비번 폼 + "구글로 시작하기" 버튼
- `/signup` — 이메일+비번 가입 + 개인정보 동의
- `/join` — 그룹 코드 입력 → 승인 대기 상태
- `/new-group` — 그룹 생성 (마스터가 됨)

### 4.2 출석판 `/attendance`
- 상단: 세션 날짜 선택 (기본 오늘) + "새 세션" 버튼
- 학년 탭 (1/2/3/전체) → 반이 있으면 반 서브탭 (가로 스크롤)
- 학생 카드 그리드 (한 줄 2~3명, 큰 터치 영역):
  - 이름 탭 = 출석 (파스텔 초록)
  - 다시 탭 = 해제
  - 카드 아래 "결석 사유" 인풋 (입력 시 노랑)
  - 미터치 = 산호색 (미확인)
- 학생 카드 길게 누르기 = 개인 상세 시트 (연락처 + 최근 출석)

### 4.3 대시보드 `/dashboard`
- 상단 카드: `오늘 출석 42/56` · `교사 8/10` · `학년별 1: 15 · 2: 14 · 3: 13`
- 반이 있으면 반별 집계도
- 오늘 미확인 학생 목록 (탭 → 연락처 시트)
- 주차별 누적 출석 그래프 (Recharts 라인)
- 우상단 "엑셀 다운로드" — 하나의 xlsx 파일에 3개 시트로:
  - 시트 1 **요약** — 오늘 및 최근 4주 학년/반별 집계
  - 시트 2 **학생별 누적** — 학생 × 세션 매트릭스 (출석/사유/미확인 표시)
  - 시트 3 **원본 기록 (raw)** — 세션ID · 날짜 · 학생 · 학년 · 반 · 상태 · 사유 · 수정자 · 수정시각 (한 행 = 하나의 attendance_record; 외부 분석·백업용)

### 4.4 일정 `/calendar`
- 월간 뷰 (react-big-calendar) — 날짜 탭 = 해당일 일정 목록
- FAB: `직접 추가` / `일정표 업로드`
- 업로드 → `/calendar/review/:uploadId` 검수 화면 (편집·삭제·추가 → 확정)

### 4.5 설정 `/settings`
- **학적부** — 학생 CRUD, 반별 그룹핑, 숨김 학생 탭, 엑셀 대량 업로드
- **교사 관리** (마스터만) — 승인 대기 큐 · 활성 교사 · 역할 변경 · 내보내기
- **그룹 관리** (마스터만) — 이름 변경 · 코드 재발급 · 진급 실행
- **알림 설정** (본인) — 이메일 다이제스트 ON/OFF · PWA 푸시 구독/해제
- **내 프로필**
- **개인정보 · 탈퇴** — 데이터 삭제 요청

### 목장 테마
- 로고: 양 실루엣, 파스텔 초록 배경
- 빈 상태 일러스트: "오늘 아직 아무도 안 왔어요 🐑"
- 색상: 파스텔 초록(출석) · 파스텔 노랑(사유) · 산호색(미확인)
- 폰트: Pretendard

## 5. 주요 워크플로우

### 5.1 그룹 가입
1. 신규 유저 `/signup` → 이메일+비번 또는 구글 → 개인정보 동의
2. `/join` 그룹 코드 입력 → `memberships.status='pending'` 생성
3. 마스터에게 인앱 배너 + 이메일 알림
4. 마스터 승인 시 역할(편집/조회) 선택 → `status='active'`
5. 반려 시 `status='removed'`

### 5.2 출석 체크 (핵심 UX)
1. 편집 교사가 `/attendance` 진입
2. 오늘 세션 없으면 자동 생성 (제목=주일예배 기본값)
3. 초기 상태: 모든 학생 = `unconfirmed` (산호색)
4. 이름 탭 → `present` (초록), 서버 즉시 upsert
5. 사유 입력 → `absent_with_reason` (노랑), 서버 반영
6. 낙관적 UI + 실패 시 롤백 + 스낵바
7. 세션 종료는 별도 버튼 없음. 다음 세션까지 계속 편집 가능

### 5.3 일정표 OCR 검수
1. 편집 교사가 PDF/이미지 업로드 → Supabase Storage
2. Edge Function 트리거: OCR (Google Cloud Vision)
3. 결과를 `calendar_uploads.extracted_events` JSON에 저장 → `awaiting_review`
4. 검수 화면에서 편집·삭제·추가
5. '확정' → `calendar_events`에 일괄 삽입, `status='confirmed'`

### 5.4 알림 스케줄링
- Supabase pg_cron: 매일 06:00 KST
- Edge Function `daily-digest`:
  - 각 그룹별로: 오늘 생일자 · 오늘 일정 · 어제 미확인 결석자 계산
  - 활성 교사에게 SendGrid로 이메일
  - PWA 구독 있으면 Web Push도 병행

### 5.5 진급 실행 (연 1회, 마스터)
1. 설정 → 그룹 관리 → '진급 실행'
2. 미리보기: "1학년 15명 → 2학년, 2학년 14명 → 3학년, 3학년 13명 → 졸업"
3. 확인 → `promotion_log`에 스냅샷 저장 → `students.grade` 일괄 +1
4. 24시간 내 '되돌리기' 가능

### 5.6 대량 업로드 (학적부) — 신규 등록 & 반 재편성 겸용
1. 학적부에서 `📥 엑셀로 한꺼번에 등록`
2. **템플릿 다운로드** — 표준 컬럼(이름·학년·반·생일월·생일일·생일연도·본인연락처·보호자연락처·보호자관계)
3. 채워서 업로드 → **미리보기 화면**:
   - 이름/학년 누락 → 오류 표시
   - 새 반 이름 → "새 반 생성" 자동 체크
   - 기존 학생 감지 (매칭 키: **이름 + 학년**, 생일 있으면 tie-breaker로 사용):
     - 반이 파일과 다르면 → "**반 이동**: 1반 → 2반" 하이라이트
     - 연락처·생일 다르면 → "정보 갱신" 표시
     - 동일하면 → "변경 없음, 건너뜀"
   - 파일에 없는 기존 학생 → **자동 삭제 안 함**. "파일 밖 학생 3명 그대로 유지" 안내 (원치 않으면 학적부에서 개별 삭제)
   - 생일 형식 오류 → 정정 요청
4. 오류 수정 · 확정 → 반 생성/이동 및 학생 신규 생성/갱신 일괄 반영
5. **활용 시나리오**:
   - **신학기 반 편성**: 진급 실행 후 새 반 편성 엑셀 업로드 → 학생별 반 재배정
   - **학기 중 반 이동**: 부분 재편성 시에도 동일 엑셀로 필요한 학생만 반 이동
   - **연락처 일괄 수정**: 기존 학생 정보만 갱신용으로 사용 가능

### 5.7 학생 소프트 삭제 · 교사 내보내기
- 학생 삭제 → `students.deleted_at = now()`
  - 출석판·대시보드에서 필터 제외
  - 학적부 '숨김' 탭에서만 확인·복원
  - 30일 후 pg_cron 하드 삭제 (출석 이력의 student_id는 nullable로 보존)
- 교사 내보내기 → `memberships.status='removed'`
  - 감사 로그
  - 그 교사가 남긴 기록은 그대로 (`updated_by` 유지)

## 6. 에러 처리

- Zod 스키마로 서버·클라이언트 공용 입력 검증
- Supabase 에러: React Query `onError` → 한국어 토스트
- RLS 위반 = 조용히 실패 (권한 없는 데이터는 존재조차 안 보임)
- 네트워크 에러: 재시도 3회 + "오프라인 상태" 스낵바
- 낙관적 UI (출석 체크): 실패 시 원래 상태로 롤백 + 재시도 버튼

## 7. 테스트 전략

- **단위 테스트** (Vitest): Zod 스키마 · 엑셀 파싱 · 진급 계산 · 마스킹
- **통합 테스트** (Vitest + Supabase 로컬): **RLS 정책이 실제로 다른 그룹 데이터를 차단하는지** (멀티테넌시 핵심)
- **E2E** (Playwright): 로그인 → 그룹 가입 → 출석 체크 → 대시보드 골든 패스 1개
- **접근성**: 색만이 아니라 아이콘·라벨도 함께

### 첫 배포 전 반드시 검증
- 다른 그룹 유저가 URL 직접 접근으로 데이터 보는지 (RLS 침투 테스트)
- 조회 교사가 편집 API 직접 호출 못 하는지 (역할 우회 테스트)
- 삭제된 학생이 어디에도 새어나오지 않는지

## 8. 개인정보 보호

- **최소 수집**: 필요한 필드만
- **가입 동의**: 이메일·구글 로그인 모두 최초 진입 시 동의 화면 통과
- **접근 통제**: 조회 교사에게 연락처 마스킹
- **그룹 격리**: RLS로 원천 차단
- **탈퇴**: 프로필 삭제 시 관련 개인정보 하드 삭제. 감사 로그의 actor_id는 유지 (익명화)
- **정책 페이지**: `/privacy` — 수집 항목 · 목적 · 보관 기간 · 문의처
- ※ 배포 전 개인정보보호법 실제 문구 확인 필요

## 9. 환경 변수

`.env.example` 참고. 실제 값은 `.env.local` (커밋 금지):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (서버 전용)
- `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- `GOOGLE_CLOUD_VISION_API_KEY` (OCR)
- 구글 OAuth 클라이언트 ID/Secret은 Supabase 대시보드에만 등록

## 10. 열린 후속 과제 (배포 전 결정)

- 개인정보 처리방침 실제 문구 · 개인정보 관리책임자
- SendGrid 발신 도메인 · SPF/DKIM 설정
- Supabase 프로덕션 프로젝트 리전 (한국은 Tokyo 리전이 가장 가까움)
- 커스텀 도메인 (선택)
- 카카오톡 알림톡은 배포 후 수요 보고 추가
