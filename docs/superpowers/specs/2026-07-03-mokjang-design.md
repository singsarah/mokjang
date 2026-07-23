# 목장 관리 앱 — 설계 문서 (PRD)

- 최초 작성: 2026-07-03 (원본 스펙: `c:\Users\Sarah\Downloads\목장관리_앱_스펙.md`)
- 전면 개정: 2026-07-18 — **현재 구현 상태 기준으로 재작성** (HEAD `321d3ea`, 마이그레이션 28개)
- 상태: §1~§9는 **구현 완료된 현재 모습**, §10은 **앞으로 할 일(미구현 백로그)** — 두 부분을 명확히 구분함

## 0. 요약

교회 고등부(또는 임의 소모임)의 출석·일정·생일·학적부·회의록을 관리하는 **멀티테넌트 모바일 우선 PWA**.
Next.js 15 + Supabase(Postgres + Auth + RLS + Storage) 스택, Vercel(Tokyo) 배포. 한 조직으로 시작해
같은 인스턴스에서 여러 조직이 격리되어 동작하며, 한 사용자가 여러 조직에 소속·전환 가능.

## 1. 확정된 결정 사항 (구현 반영됨)

| 항목 | 결정 (현재 구현) |
|---|---|
| 기술 스택 | Next.js 15 (App Router) + React 19 + Supabase, Tailwind(자체 컴포넌트), Pretendard, 파스텔 팔레트(Sage·Lavender·Wheat·Blush 등, 2차 리뉴얼) |
| 배포 | Vercel(**Tokyo 리전**) + Supabase 클라우드, 개발 포트 3100 고정, npm 고정 |
| 기기 | 모바일 우선, PWA 설치 가능 (오프라인 캐시·푸시는 미구현 — §10) |
| 인증 | 이메일+비번 + 구글 OAuth (Supabase Auth) + **로그인 없는 데모 모드** |
| 권한 | master(대표교사, **복수 가능**) · editor(편집) · viewer(조회) |
| 멀티 조직 | 한 유저가 여러 조직 소속, 로그인 후 조직 선택 화면 + 설정에서 조직 전환 (쿠키로 활성 조직 유지) |
| 탭 구성 | **5탭**: 출석 🐑 · 일정 📅 · **회의록 📝** · 대시보드 📊 · 설정 ⚙️ |
| 반 구조 | 반은 학년과 독립(자유 이름 + 담당 선생님 + 정렬 순서), 학생의 학년도 선택 사항 |
| 학적부 필드 | 교회 학적부 수준으로 확장 — §3 `students` 참고 (사진·학교·보호자 2인·세례·카카오·주소 등) |
| 학생 입력 | 엑셀 업로드(최대 500행, 다운로드와 왕복 호환) + 수동 CRUD + 반 상세에서 직접 생성 |
| 출석 저장 | DB에는 `present`/`absent_with_reason`만 저장, 미확인은 화면에서 계산 (반에 기록이 생기면 무기록 학생 = 연락필요) |
| 출석 마감 | 세션 **마감(closed) 흐름 있음** — 마감해야 통계·엑셀에 반영, 재오픈은 master만 |
| 모임 일정 | 조직 관리에서 **정기 모임 요일 + 요일별 모임 이름 + 임시 모임(날짜+이름)** 설정 → 출석 기본 날짜 = 최근 모임일 |
| 일정 가져오기 | ~~OCR(Google Vision)~~ → **템플릿 엑셀 즉시 파싱 + 자유형식(엑셀/이미지/PDF)은 Claude AI 구조화 추출** 후 사람 검수·확정 |
| 내보내기 | 학생·교사 명단 엑셀(가져오기와 왕복), 출석부 엑셀(단일 시트: 학생×세션 + 요약행). viewer는 내보내기 불가 |
| 진급 | master가 '진급 실행' → 전 학년 +1, 3학년 졸업 처리. 연 1회 서버 가드. 일괄 되돌리기는 없음(개별 졸업 복원만) |
| 조직 가입 | 8자리 코드 입력 또는 초대 링크(`/invite/[code]`) → 승인 대기 → master 승인 |
| 개인정보 | 가입 동의 게이트 + viewer 연락처 마스킹 + 계정 삭제(단독 조직 하드 삭제 / 공유 조직 탈퇴+익명화) + `/privacy` |
| 알림 | **미구현** (이메일 다이제스트·푸시 모두 §10 백로그) |

## 2. 아키텍처

```
┌────────────────────────────────┐         ┌───────────────────────────┐
│  Next.js 15 (App Router)       │         │  Supabase                 │
│  · React 19 서버 컴포넌트      │◄──HTTPS─►  · Postgres + RLS         │
│  · Tailwind + Pretendard       │         │  · Auth (이메일+구글)     │
│  · PWA manifest                │         │  · Storage(student-photos)│
│  · Vercel 배포 (Tokyo)         │         └───────────────────────────┘
└─────────┬──────────────────────┘
          │ 서버 액션에서 직접 호출
          ▼
   Claude API (@anthropic-ai/sdk)
   일정표 자유형식 추출 (엑셀·이미지·PDF)
```

### 멀티테넌시 원칙
- 모든 테넌트 테이블에 `group_id` + RLS. 격리는 DB 레벨에서 강제.
- 한 유저가 여러 그룹 소속 가능(구현됨). 활성 그룹은 쿠키(`setCurrentGroup`)로 관리, `/select-group`에서 전환.
- 특정 조직이 완전 분리를 원하면 같은 마이그레이션을 새 Supabase 프로젝트에 배포하고 env만 교체.

### 클라이언트 계층 (`lib/supabase/`)
- `server.ts` 쿠키 기반 유저 클라이언트(RLS 적용) — 모든 사용자 행위는 이걸로.
- `service.ts` 서비스롤(RLS 우회) — **감사 로그 기록·데모 시드/정리·계정 삭제 등 서버 전용만**.
- `client.ts` 브라우저, `middleware.ts` 세션 갱신.

## 3. 데이터 모델 (마이그레이션 28개 반영, 최종 상태)

### 테이블 요약

| 테이블 | 용도 · 주요 컬럼 |
|---|---|
| `groups` | 조직(테넌트). name, join_code(8자 `[A-Z0-9]`), last_promoted_year(진급 연1회 가드), **meeting_days**(smallint[], 0=일~6=토), **meeting_day_names**(jsonb, 요일별 모임 이름) |
| `profiles` | auth.users 1:1, 가입 트리거 자동 생성. display_name, email, birthday_month/day, privacy_consent_at(동의 게이트) |
| `memberships` | 소속+권한. role(`master/editor/viewer`), status(`pending/active/removed`), UNIQUE(group_id, user_id) |
| `classes` | 반. **학년 독립** — name(그룹 내 유니크), teacher_name, display_order |
| `students` | 학적부. name, grade(nullable), gender, 생일(월/일/연), phone_self, 보호자1(관계·기타상세·이름·전화), 보호자2(관계·이름·전화), school, baptism, kakao_id, address, family_note, note, parent_chat_invited, registration_submitted, **photo_path**(비공개 버킷), **deleted_at**(숨김), **graduated_at**(졸업, 반 배정도 해제) |
| `teachers` | 교사 명단(멤버십과 별개 인적사항). name, 생일, phone, kakao_id, duty, job_type, note, **user_id**(계정 연결, UNIQUE) |
| `attendance_sessions` | 날짜별 세션. session_date(그룹 내 유니크), note(모임 이름), **closed_at/closed_by**(마감) |
| `attendance_records` | 출석 기록. status `present/absent_with_reason/unconfirmed`(실제 저장은 앞 2개), reason. 트리거로 그룹 일치·마감 세션 변경 차단 |
| `calendar_events` | 일정. title, event_date, event_time, description, source(`manual/import`) |
| `meeting_minutes` | 회의록. title, meeting_date, content(자유 텍스트) |
| `extra_meetings` | 임시 모임. PK(group_id, meeting_date), name(없으면 요일 이름/기본값 폴백) |
| `teacher_absences` | 교사 출타 기간. teacher_id, start_date~end_date(최대 1년), reason |
| `audit_log` | 감사 로그. group_id 필수(활성 멤버만 읽기), **유저 INSERT 정책 없음 — 서비스롤 전용** |

계정 삭제 대비: created_by/approved_by/closed_by/teachers.user_id 등 유저 FK는 전부 `ON DELETE SET NULL` — 탈퇴해도 기록은 남고 연결만 익명화.

### RPC 함수
- `find_group_by_code(code)` — 초대코드로 그룹 조회 (멤버십 생성 전).
- `promote_group(group_id)` — 진급 원자 실행: 1·2학년 +1, 3학년 졸업. master 전용, 서버 연도 기준 연 1회.
- `is_active_member` / `user_role_in_group` / `is_teacher_self` — RLS 헬퍼(SECURITY DEFINER).
- **규칙: 모든 SECURITY DEFINER 함수는 `SET search_path = ''` + 스키마 정규화 필수.**

### RLS 요지
- 읽기: 활성 멤버. 쓰기: master/editor (학생·반·출석·일정·회의록).
- **master 전용 쓰기**: groups UPDATE, memberships 관리, teachers 명단, extra_meetings/모임 요일, 마감 세션 재오픈.
- **teacher_absences**: viewer 포함 본인(명단에 계정 연결된 교사) 쓰기 가능 + master는 전체. USING+WITH CHECK로 teacher_id 바꿔치기 차단.
- Storage `student-photos`: 비공개 버킷, 경로 `<group_id>/…`, 읽기=그룹 멤버, 쓰기=master/editor.
- viewer의 학생 연락처는 애플리케이션 레벨 마스킹(010-****-1234) + 엑셀 내보내기 차단으로 우회 방지.

## 4. 화면 구성 (현재 구현)

### 하단 탭바 — 5탭
🐑 출석 `/attendance` · 📅 일정 `/calendar` · 📝 회의록 `/minutes` · 📊 대시보드 `/dashboard` · ⚙️ 설정 `/settings`
공통 셸: `requireCurrentMembership()` 게이팅 + PrivacyGate(동의) + 데모면 DemoTour + SiteFooter.

### 4.1 인증 · 온보딩
- `/login` — 구글 OAuth + 이메일/비번 + **"체험 시작"**(데모). `/signup` — 가입 + 개인정보 동의.
- `/select-group` — **조직 선택/전환**: active 조직 목록, pending은 "승인 대기 중", 없으면 생성/참여 안내.
- `/join`(코드 입력) · `/invite/[code]`(초대 링크) · `/new-group`(생성, 8자 코드 자동 발급).

### 4.2 출석 `/attendance`
- **기본 날짜 = 오늘 이하 가장 최근 모임일** (정기 요일+임시 모임 기준). 모임 요일 미설정 그룹은 오늘 + 매일 이동.
- ◀▶는 모임일 사이만 이동하되, 기록이 이미 있는 날짜는 모임일이 아니어도 포함.
- 헤더: 조직 이름 + `✝ 모임 이름` 배지 (우선순위: 조직관리 설정 이름 → 세션 note → 기본값 "주일예배"(일)/"모임").
- **언덕 풍경 UI**: 반 팻말 탭 + 우리(pen) 카드 안 학생 원형 버튼 4열 그리드, 하단 고정 SVG 언덕(라벤더 산→더스티블루 능선→세이지 초원).
- 상태 4가지 표시: 미체크(Lavender) / 출석(Sage) / 사유결석(Wheat, 사유 입력칸) / **연락필요(Blush)** — 반에 기록이 하나라도 생기면 무기록 학생이 연락필요로 바뀜.
- **마감 흐름**: "출석 마감하기" → 미체크 경고 confirm → closed. 마감돼야 통계·엑셀 반영. 미마감이면 "이 날 기록 전체 삭제" 가능. **재오픈은 master만**, editor에겐 요청 안내.

### 4.3 일정 `/calendar`
- 자체 CSS grid 월간 뷰(외부 라이브러리 없음), **일요일 칸 3배 폭**. 셀 탭 → 팝업(일정 줄 탭 → 수정 모달, editor+). "이번 달 목록"은 **주요 일정 / 생일·출타 탭**(스카이 세그먼트, 기본=주요 일정)으로 분리.
- 표시: 일정 + 학생·교사 생일(🎂, 사진·성별 점·학년반) + **교사 출타**(✈️ gold 마커, "이름 외 N").
- 추가: 수동 모달 / **일정표 가져오기** `/calendar/import` — 템플릿 엑셀(날짜|시간|제목|설명)은 즉시 파싱, 자유형식 엑셀·이미지·PDF는 **Claude AI 구조화 추출** → 표에서 검수·수정 → 일괄 등록(최대 200건, 날짜+제목 중복 스킵).
- 출타 등록: viewer 포함 본인 것 가능(명단에 계정 연결 필요), master는 임의 교사.

### 4.4 대시보드 `/dashboard`
1. 지난 미마감 세션 알림(마감하러 가기 링크)
2. 요약 카드: 세션 출석 n/재적 + ◀▶ 세션 이동 + 출석/사유결석/미확인 3칸(탭하면 명단) + 반별 3열 그리드(이름 왼쪽·n/재적 오른쪽)
3. 출석 추이 그래프: **이번주 포함 직전 4주 고정**(주=일~토, 주에 마감 세션 여러 개면 마지막 것), 출석/결석 토글(결석=사유결석+미확인 두 색 스택, 세그먼트 안에 각각 숫자), 모든 막대 위 인원수·y축 눈금, 자료 없는 주는 빈 칸 + **출석부 다운로드**
4. 연락필요: 미확인 학생 연락처(viewer 마스킹)
5. 이번 달 생일(학생+교사, 당일 🎂 강조)
- 출석부 엑셀: **단일 "출석부" 시트** — 행=학생, 열=세션 날짜, 하단 요약행(합계 + 학년·반별 n/재적).

### 4.5 회의록 `/minutes`
- 목록(최신순 카드: 날짜·제목·미리보기) · 상세 · 작성 · 수정. 필드: 제목·회의날짜·본문. 쓰기 master/editor, 읽기 전원.

### 4.6 설정 `/settings`
- **학적부** — 반별→학년별→미배정 섹션, 이름 검색, 생일 배지, `+ 추가`·`⬆️ 진급`(master)·숨김·졸업생, 엑셀 업로드/다운로드, 체크박스 다중 선택 → **일괄 숨김/일괄 졸업**(최대 500). 숨김 `/roster/hidden`·졸업생 `/roster/graduated`(복원 가능).
- **반 관리** — 반 CRUD(이름·담당 선생님·정렬), 다중 선택 일괄 삭제, 반 상세에서 학생 배정·신규 생성.
- **교사 관리** (master) — 가입 승인/거부, 역할 변경, 제거(마지막 master 강등 방지), **교사 명단↔계정 연결**(이름 일치 자동 제안), 교사 엑셀 업로드/다운로드.
- **조직 관리** (master) — 조직 이름, **모임 요일·요일별 모임 이름·임시 모임**, 참여 코드/초대 링크 공유.
- **조직 전환** · **개인정보 처리방침** `/privacy` · 로그아웃 · **계정 삭제** `/settings/delete-account`.

### 데모 모드
- 로그인 화면 "체험 시작" → 1회용 계정(`demo-*@example.test`) + "체험 목장" 자동 시드(교사 6·학생 12·반 3·일정·회의록·지난 3주 마감 출석) + 가이드 투어.
- 48시간 후 다음 체험 시작 시 자동 정리. **제한**: AI 일정 추출 차단(템플릿만), 실제 조직 초대 참여 차단.

## 5. 주요 워크플로우 (현재 구현)

### 5.1 조직 가입·승인
코드/초대 링크 → `memberships status='pending'` → `/pending` 대기 → master가 교사 관리에서 승인(역할 선택) → active. 거부 시 removed.

### 5.2 출석 체크 → 마감 (핵심 UX)
1. 출석 탭 진입 → 최근 모임일 판 자동 표시 (세션은 첫 기록 시 upsert)
2. 학생 원형 버튼 탭 = 출석 토글, 사유칸 입력 = 사유결석
3. 반에 기록이 생기는 순간 무기록 학생 = 연락필요(빨강)로 표시
4. 낙관적 UI + 실패 롤백
5. **"출석 마감하기"** → 미체크 인원 경고 → 마감. 마감 후 잠김, 통계·대시보드·엑셀에 반영
6. 수정 필요 시 master가 마감 해제 → 수정 → 재마감

### 5.3 일정표 가져오기 (AI 검수 확정)
파일 업로드 → 템플릿이면 즉시 파싱 / 자유형식이면 Claude 구조화 추출 → 검수 표에서 편집·삭제 → 확정 시 `calendar_events` 일괄 삽입(source='import'). 업로드 원본은 저장하지 않음(즉시 처리).

### 5.4 진급·졸업 (연 1회, master)
'진급 실행' → confirm → `promote_group` RPC: 1·2학년 +1, 3학년 `graduated_at` + 반 해제. `last_promoted_year`로 같은 해 중복 실행 차단. 일괄 되돌리기 없음 — 실수는 졸업생 페이지 개별 복원 + 학생 수정으로 수습.

### 5.5 학생 엑셀 업로드/다운로드 (왕복 호환)
다운로드한 20열 양식 그대로 재업로드 가능. 업로드는 (이름+학년) 중복 스킵, 반 이름 자동 매칭, 생일·성별·보호자 관계 정규화, 최대 500행. 신학기 반 편성·연락처 일괄 갱신에 사용.

### 5.6 학생 숨김·졸업·교사 내보내기
- 숨김 = `deleted_at`(출석판·통계 제외, 숨김 탭에서 복원) · 졸업 = `graduated_at`(명단·출석 제외, 졸업생 페이지에서 복원).
- 교사 제거 = `memberships status='removed'` + 감사 로그. 남긴 기록의 updated_by는 유지.

### 5.7 계정 삭제
`/settings/delete-account` → 단독 조직이면 조직째 하드 삭제, 공유 조직이면 탈퇴 처리. 유저 FK는 SET NULL로 익명화되어 그룹 기록은 보존.

## 6. 에러 처리
- Zod로 서버·클라이언트 공용 검증, 서버 액션은 한국어 에러 메시지 반환.
- RLS 위반 = 조용히 실패(존재 자체가 안 보임). 낙관적 UI 실패 시 롤백.

## 7. 테스트 전략 (현재 운용)
- 단위(Vitest): 엑셀 파싱·마스킹·출석 사이클 등. 통합(Vitest): **RLS 격리 — dev 프로젝트에 직접 실행**(`test-…@example.test` 유저만 정리하므로 실데이터 안전).
- E2E(Playwright): 골든 패스. 폼 제출은 하이드레이션 경쟁 때문에 단일 click 금지 → `submitUntilUrl` 재시도 패턴.
- **출시 기준**: `npm run typecheck && npm test && npm run test:e2e && npm run build` 4개 전부 통과.

## 8. 개인정보 보호
- 최소 수집 + 가입 시 동의 게이트(PrivacyGate) + `/privacy` 정책 페이지(계정 삭제 조항 포함).
- viewer 연락처 마스킹 + 엑셀 내보내기 차단. 그룹 격리는 RLS.
- 계정 삭제 시 개인 프로필 삭제, 그룹 기록은 익명화 보존(§5.7).

## 9. 환경 변수 (현재 실제 사용)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`(서버 전용)
- `NEXT_PUBLIC_APP_URL` (OAuth 콜백·동의 리다이렉트)
- `ANTHROPIC_API_KEY` (일정표 AI 추출 — 없으면 템플릿 파싱만 동작)
- 구글 OAuth ID/Secret은 Supabase 대시보드에만 등록
- ~~SendGrid·VAPID·Google Vision 키~~ — 해당 기능 미구현으로 불필요 (§10)

---

# 10. 앞으로 할 일 (미구현 백로그) — 여기서부터는 구현되지 않은 계획

> §1~§9와 달리 이 섹션은 전부 **아직 없는 기능**. 착수 전 사용자와 우선순위 확인.

### 10.1 원래 스펙에 있었으나 미구현
| 항목 | 내용 | 비고 |
|---|---|---|
| **알림 전체** | 아침 이메일 다이제스트(발송 인프라 + pg_cron/Vercel cron) + PWA 푸시(service worker, `push_subscriptions` 테이블, VAPID) + 인앱 배너 | 원 스펙의 SendGrid는 재검토 필요(Resend 등 대안 포함). iOS는 PWA 설치 후에만 푸시 가능 |
| **숨김 학생 자동 하드 삭제** | 소프트 삭제 30일 후 자동 하드 삭제 (pg_cron 또는 앱 레벨 스케줄) | 현재는 숨김 상태로 무기한 보존 |
| **진급 일괄 되돌리기** | 원 스펙의 "24시간 내 되돌리기"(promotion_log 스냅샷) 미구현 | 현재는 개별 졸업 복원만. 연 1회 가드가 있어 실수 여지는 작음 |
| **오프라인 읽기 캐시** | PWA service worker 캐싱 | 현재는 온라인 전제 |
| **접근성 점검** | 색 외 아이콘·라벨 병행 원칙의 체계적 검증 | 부분 적용됨 |

### 10.2 배포·운영 후속 과제
- 개인정보 처리방침 실제 법률 문구 검토 · 개인정보 관리책임자 지정
- 커스텀 도메인 (선택)
- 카카오톡 알림톡 — 배포 후 수요 보고 결정
- 이메일 발송 도메인 SPF/DKIM (알림 구현 시)

### 10.3 사용 피드백 대기 (아이디어 단계, 확정 아님)
- 사라 폰 실사용 피드백 반영 (모임 이름 설정 배포 직후 단계)
- 출석부 엑셀에 원본(raw) 시트 추가 여부 — 원 스펙은 3시트(요약·학생별·raw)였으나 현재 단일 시트로 단순화됨. 외부 분석 수요가 생기면 재검토
- 학생 카드 길게 눌러 개인 상세 시트(연락처+최근 출석) — 원 스펙 아이디어, 현재는 학적부 상세로 대체

### 이 문서의 유지 규칙
- 기능이 추가·변경되면 §1~§9를 같은 커밋에서 갱신하고, 구현되면 §10에서 해당 줄을 제거할 것.
