# Plan 2 — 학적부 (학생 명단) 설계 문서

- 작성일: 2026-07-06
- 상위 설계: `docs/superpowers/specs/2026-07-03-mokjang-design.md` (전체 앱 설계 — 확정 결정의 원천)
- 선행: Plan 1 (기반 + 인증) — main에 병합 완료
- 상태: 사용자 승인 완료 (2026-07-06), 구현 계획 대기

## 0. 요약

교사가 학생 명단을 **손으로** 관리하는 기능. 학생·반 테이블과 RLS를 세우고, 학생 CRUD(추가·수정·소프트 삭제·복원)와 반 관리, 조회 교사 연락처 마스킹을 구현한다. 출석·대시보드·진급 등 이후 모든 데이터 기능의 토대.

## 1. 범위

### 포함
- `classes`, `students` 테이블 + 인덱스 + RLS 마이그레이션
- 학생 수동 CRUD: 추가 · 수정 · 소프트 삭제 · 복원
- 반 관리: 생성 · 이름 변경 · 순서(display_order) · 삭제(빈 반만)
- 반 없이 쓰는 소규모 그룹 지원 (`class_id` nullable)
- 조회 교사(viewer) 연락처 마스킹 (`010-****-1234` 형태)
- "숨김(삭제된) 학생" 조회 · 복원 화면
- 단위 + 통합(RLS) 테스트

### 제외 (다음 플랜)
- **엑셀 대량 업로드 / 템플릿 / 미리보기 diff → Plan 3** (학생·반 CRUD가 먼저 존재해야 그 위에 얹을 수 있고, 매칭·미리보기 로직이 그 자체로 큼)
- 출석 체크 (attendance_*) → 이후 플랜
- 진급 실행 (promotion_log) → 이후 플랜
- 소프트 삭제 30일 후 하드 삭제 pg_cron → 출석 이력이 생기는 플랜에서 함께 (지금은 student_id 참조 테이블이 없어 하드 삭제 안전성 검증 불가). Plan 2는 **소프트 삭제까지만**.

## 2. 데이터 모델 (신규 마이그레이션)

상위 설계 문서 §3 그대로. 마이그레이션 파일명은 구현 시 `npx supabase migration list --linked`로 마지막 번호 확인 후 다음 번호 사용 (예: `20260706000001_student_roster.sql`).

```sql
-- 반
CREATE TABLE classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  grade int NOT NULL,
  name text NOT NULL,           -- '1-1', '믿음반' 등
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, grade, name)
);

-- 학생
CREATE TABLE students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,  -- 반 없으면 NULL
  name text NOT NULL,
  grade int NOT NULL,           -- 반과의 일관성은 앱에서 보장
  birthday_month int,           -- 1~12
  birthday_day int,             -- 1~31
  birthday_year int,            -- 선택
  phone_self text,
  phone_guardian text,
  guardian_relation text,       -- '모' | '부' | '기타'
  deleted_at timestamptz,       -- 소프트 삭제 (NULL = 활성)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_students_group_deleted ON students(group_id, deleted_at);
CREATE INDEX idx_classes_group ON classes(group_id, grade, display_order);
```

- `class_id`에 `ON DELETE SET NULL`: 반이 삭제돼도 학생은 남고 반 미배정 상태가 됨. 단 UI는 "빈 반만 삭제 허용"으로 실수를 예방.
- `updated_at` 자동 갱신: 수정 서버 액션에서 `updated_at = now()` 명시 (트리거 대신 앱 레벨 — Plan 1 패턴과 일관, 단순).

## 3. RLS 정책

Plan 1의 헬퍼 재사용: `is_active_member(gid, uid)`, `user_role_in_group(gid, uid)`.

```sql
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- 읽기: 활성 멤버 전원 (viewer 포함)
CREATE POLICY "members read classes"  ON classes  FOR SELECT
  USING (is_active_member(group_id, auth.uid()));
CREATE POLICY "members read students" ON students FOR SELECT
  USING (is_active_member(group_id, auth.uid()));

-- 쓰기(INSERT/UPDATE/DELETE): master·editor만
CREATE POLICY "editors write classes"  ON classes  FOR ALL
  USING (user_role_in_group(group_id, auth.uid()) IN ('master','editor'))
  WITH CHECK (user_role_in_group(group_id, auth.uid()) IN ('master','editor'));
CREATE POLICY "editors write students" ON students FOR ALL
  USING (user_role_in_group(group_id, auth.uid()) IN ('master','editor'))
  WITH CHECK (user_role_in_group(group_id, auth.uid()) IN ('master','editor'));
```

- `FOR ALL` = INSERT+UPDATE+DELETE+SELECT 커버. SELECT는 위 read 정책과 OR로 합쳐지므로 viewer도 읽기는 됨(정책은 OR 결합).
- 소프트 삭제는 UPDATE(`deleted_at` 세팅)이므로 editor 권한이면 됨. 물리 DELETE는 앱에서 사용 안 함(빈 반 삭제만 예외).

## 4. 연락처 마스킹 (애플리케이션 레벨)

RLS는 행 단위 접근 제어라 컬럼 마스킹을 못 함. 따라서 **조회 계층에서** 처리:
- `lib/students.ts`에 `maskPhone(phone: string): string` — 가운데를 `****`로 (`010-1234-5678` → `010-****-5678`). 형식이 예상과 다르면 앞 3자리만 남기고 마스킹.
- 학생 목록/상세를 로드하는 서버 컴포넌트/액션에서 현재 멤버십 role을 확인해, **viewer면 `phone_self`/`phone_guardian`을 마스킹한 뒤** 클라이언트로 전달. editor·master는 원본.
- 단위 테스트로 마스킹 함수 커버.

## 5. 화면 · 컴포넌트

설정 하위. 상위 설계 §4.5의 "학적부"를 구체화.

- `app/(app)/settings/roster/page.tsx` — 학생 목록 (서버 컴포넌트)
  - 활성 학생을 반별 그룹핑(반 없으면 학년별) 후 표시
  - 상단: "학생 추가" 버튼(editor+), "숨김 학생" 탭 링크, "반 관리" 링크
  - 학생 카드: 이름 · 학년/반 · (권한 따라) 연락처. 탭 → 수정 화면
- `app/(app)/settings/roster/new/page.tsx` — 학생 추가 폼
- `app/(app)/settings/roster/[studentId]/page.tsx` — 학생 상세/수정 폼 (+ 소프트 삭제 버튼)
- `app/(app)/settings/roster/hidden/page.tsx` — 숨김 학생 목록 + 복원
- `app/(app)/settings/roster/classes/page.tsx` — 반 생성·이름변경·순서·삭제
- 권한: 페이지는 활성 멤버면 진입 가능(읽기). 편집 UI(추가/수정/삭제/반관리 버튼과 폼)는 **editor·master만** 노출 + 서버 액션에서 재검증.

## 6. 서버 액션

`app/actions/students.ts`, `app/actions/classes.ts` (Plan 1 `memberships.ts` 패턴 답습 — Zod 파싱 → 권한 확인 → RLS 유저 클라이언트로 mutate → `revalidatePath`).

- students: `createStudent`, `updateStudent`, `softDeleteStudent`, `restoreStudent`
- classes: `createClass`, `renameClass`, `reorderClasses`, `deleteClass`(빈 반만 — 소속 학생 있으면 거부)
- 각 액션: `requireCurrentMembership()`로 role 확인, `role in ('master','editor')` 아니면 거부. `group_id`는 항상 현재 멤버십 것으로 강제(요청값 신뢰 안 함).
- 감사 로그: 학생 삭제 등 민감 동작은 Plan 1의 서비스롤 `logAudit` 패턴 재사용(선택 — 최소 `student_deleted` 기록).

## 7. 입력 검증 (Zod)

`lib/validation/student.ts`:
- name: 비어있지 않음
- grade: 정수(예: 1~3, 그룹에 따라 다를 수 있으니 1~6 허용)
- birthday_month 1~12 / day 1~31 / year 선택 (셋 다 optional, 있으면 범위 검증)
- phone_self/guardian: optional, 느슨한 한국 전화번호 정규식
- guardian_relation: '모'|'부'|'기타' enum, optional

## 8. 테스트

상위 설계 §7 전략 따름.
- **단위(Vitest):** 학생/반 Zod 스키마, `maskPhone` 함수
- **통합(RLS, Vitest):** `tests/integration/`에 추가 — (1) viewer가 students INSERT/UPDATE 거부됨, (2) editor는 학생 생성 가능, (3) 타 그룹 학생 안 보임, (4) 소프트 삭제 학생이 기본(활성) 조회에서 제외됨. Plan 1 `setup.ts`의 `createTestUser`/`cleanup` 재사용.
- E2E: 별도 신규 없음(골든패스는 Plan 1). 필요 시 학생 추가 스모크만 최소.

## 9. 결정된 사항 · 열린 과제

- ✅ 범위: 수동 CRUD까지. 엑셀은 Plan 3. (사용자 승인)
- ✅ 소프트 삭제까지만, 하드 삭제 cron은 뒤로.
- 열림(구현 중 무방): 학년 허용 범위(1~3 vs 1~6) — 우선 1~6 느슨하게. 반 순서 UI 방식(위/아래 버튼 vs 드래그) — 단순히 위/아래 버튼 권장.

## 10. 위험 · 주의 (Plan 1 학습 반영 — `CLAUDE.md` 참조)
- 새 마이그레이션 번호는 `migration list`로 확인 후 부여(타임스탬프 충돌 주의).
- `SECURITY DEFINER` 새 함수 만들면 `SET search_path=''` + 스키마 정규화 필수(이번엔 신규 함수 없을 전망).
- 새 테이블 타입은 `gen types`가 이 머신에서 실패하므로 `lib/supabase/database.types.ts` 수동 갱신 필요.
- Playwright 폼 제출은 재시도 패턴 사용(단일 클릭 금지).
