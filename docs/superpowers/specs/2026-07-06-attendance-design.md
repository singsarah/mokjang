# 출석 체크 (출석판) 설계 문서 — 목장 테마

- 작성일: 2026-07-06
- 상위 설계: `docs/superpowers/specs/2026-07-03-mokjang-design.md` (§4.2 출석판, §5.2 출석 워크플로우)
- 선행: Plan 1(기반+인증), Plan 2(학적부) — `plan-2-student-roster` 브랜치에 존재
- 상태: 사용자 승인 완료 (2026-07-06, 비주얼 목업 v8 확정), 구현 계획 대기

## 0. 요약

교사가 주일예배 등 세션마다 학생 출석을 체크하는 **출석판**. 학생을 **반(班)별 탭**으로 묶고, 선택한 반은 **목장 테마**(초록 배경 + 나무 울타리 우리 + 나무 팻말)로 그려 학생 이름을 **양떼 동그라미**로 표시한다. 카드를 탭할 때마다 상태가 순환하며 즉시 저장된다.

## 1. 범위

### 포함
- `attendance_sessions`, `attendance_records` 테이블 + RLS
- 출석판 `/attendance`: 날짜(세션) 선택 + 반별 탭 + 목장 UI + 양떼 카드
- 탭 순환 상태 저장(낙관적 UI), 결석 사유 입력
- 조회 교사 읽기 전용

### 제외 (다음 플랜)
- 통계·그래프·엑셀 내보내기 → **대시보드 플랜**
- 여러 세션/하루, 세션 제목 편집 고급 기능 → 후속(지금은 하루 1세션, 기본 제목 "주일예배")
- 결석 학생 자동 알림/연락 → 알림 플랜

## 2. 상태 모델 (핵심)

한 학생 카드를 탭하면 상태가 순환한다. 원래 상위 스펙(§5.2)은 "초기 = 전원 unconfirmed"였으나, **사용자 확정 모델은 초기 = 중립(기록 없음)** 이다.

| 상태 | 색(목장 양) | 데이터 (`attendance_records`) |
|---|---|---|
| 미체크(중립) | 흰색 양 | **레코드 없음** |
| 출석 | 진초록(sage-deep) | status `present` |
| 사유결석 | 노랑(gold) | status `absent_with_reason`, `reason` 채워짐 |
| 연락필요(무단) | 빨강(danger) | status `unconfirmed`, `reason` 빈값 |

**탭 순환:** 중립 → (탭) 출석 → (탭) 결석 모드(사유 입력칸 표시) → (탭) 중립. 결석 모드에서 **사유를 적고 저장 → 노랑(absent_with_reason)**, **비우고 저장 → 빨강(unconfirmed, "연락필요")**.

- 각 상태 변경은 **서버에 즉시 upsert/delete**(낙관적 UI: 화면 먼저 반영 → 서버 저장 → 실패 시 롤백 + 토스트).
- 중립(기록 없음)과 unconfirmed(빨강, 적극적으로 결석 표시)는 구분된다.

## 3. 반별 탭 & 목장 UI

- 상단: **날짜 네비게이션**(◀ 오늘 ▶, 지난 날짜 조회·수정 가능) + 세션 배지("주일예배").
- **반 탭**: 가로 스크롤 1줄 (반이 많아도 좌우 스크롤). 반이 없는 학생용 **"반 없음"** 탭 자동 추가. 활성 탭 = sage-deep.
- **범례**: 탭 아래 / 팻말 위. 미체크·출석·사유결석·연락필요 4색.
- **목장 씬**(선택된 반):
  - 배경: 팔레트 초록 그라데이션 + 언덕 실루엣 + 언덕 위 양 이모지(장식).
  - **나무 팻말**: 반 이름(**교보손글씨**) + 옆에 작은 **선생님 이름**(기본폰트). `classes.teacher_name` 사용(Plan 2에서 추가됨).
  - **나무 울타리 우리(pen)**: 진한 브라운 단색 테두리(얇게), 손그림 느낌(SVG 러프 필터), 안쪽 잔디 초록.
  - **양떼 카드**: 흰색 양 동그라미(organic 모양 + 작은 다리), 4열 그리드. 상태별 색. 사유결석/연락필요 양 아래 작은 캡션(사유 텍스트 / "연락필요").
- 실제 앱 색은 design-guide 팔레트: present `#4E6A47`(sage-deep) · excused `#F0C86E`(gold) · unconfirmed `#D9645F`(danger) · 미체크 흰색 `#FBEEE6` · 잔디 `#A7C58C` · 울타리/팻말 브라운.
- 확정 목업: `.superpowers/brainstorm/.../attendance-pasture-v8.html` (참고용, git 미포함).

## 4. 날짜 / 세션

- 하루 1세션. `attendance_sessions` UNIQUE(group_id, session_date).
- 해당 날짜 세션이 없고 교사가 진입하면 **자동 생성**(note 기본값 "주일예배").
- 지난 날짜 선택 시 그 세션 로드(없으면 조회만/생성 안내). 세션 종료 버튼 없음(다음 세션까지 계속 편집).

## 5. 데이터 모델 (상위 스펙 §3)

```sql
attendance_sessions (
  id uuid PK, group_id uuid FK, session_date date NOT NULL,
  note text, created_by uuid, created_at timestamptz DEFAULT now(),
  UNIQUE(group_id, session_date)
)
attendance_records (
  id uuid PK, group_id uuid FK, session_id uuid FK REFERENCES attendance_sessions ON DELETE CASCADE,
  student_id uuid FK REFERENCES students ON DELETE CASCADE,
  status text CHECK (status IN ('present','absent_with_reason','unconfirmed')),
  reason text, updated_by uuid, updated_at timestamptz DEFAULT now(),
  UNIQUE(session_id, student_id)
)
```
- 인덱스: `(group_id, session_date)` on sessions, `(session_id)` / `(group_id, student_id)` on records.
- 미체크 = records 행 없음. 상태 변경 = upsert(status,reason). 중립으로 되돌리기 = 해당 record delete.
- ⚠️ `student_id ON DELETE CASCADE`: 지금은 학생이 **소프트 삭제만** 되므로 안전. 상위 스펙 §5.7의 "하드삭제 후에도 출석 이력 보존(student_id nullable)"은 학생 하드삭제(30일 cron)를 만드는 플랜에서 `SET NULL`+nullable로 재검토한다(현재 하드삭제 기능 없음).

## 6. RLS (Plan 1 헬퍼 재사용)

- 읽기: 활성 멤버 전원(viewer 포함) — `is_active_member(group_id, auth.uid())`.
- 쓰기(INSERT/UPDATE/DELETE): master·editor — `user_role_in_group(...) IN ('master','editor')`.
- 세션·레코드 모두 group_id 스코프. 서버 액션은 group_id를 현재 멤버십에서 강제, `student_id`/`session_id`가 같은 그룹인지 확인.

## 7. 서버 액션 / 조회

- `app/actions/attendance.ts`:
  - `ensureSession(date)` → 세션 없으면 생성 후 반환(editor+).
  - `setAttendance({ sessionId, studentId, status, reason })` → upsert(editor+, group 스코프).
  - `clearAttendance({ sessionId, studentId })` → record delete(중립 복귀).
- `lib/attendance.ts` `loadBoard(date)` → 세션 + 반 목록 + 학생 + 해당 세션 레코드를 묶어 반별로 그룹핑, viewer면 편집 불가 플래그. (연락처 마스킹은 출석판에선 불필요 — 이름만 노출.)

## 8. 컴포넌트 (목장 UI)

- `app/(app)/attendance/page.tsx`(서버): 날짜 파라미터 → `loadBoard` → 클라이언트 보드 렌더.
- `components/attendance-board.tsx`(클라이언트): 반 탭 + 목장 씬 + 양떼. 탭 순환/사유 입력/낙관적 저장 상태 관리, 서버 액션 호출.
- `components/pasture-*`: 팻말·울타리·양 카드 등 프레젠테이션 조각(필요 시 분리). SVG 러프 필터는 전역 1회.
- 손글씨 팻말은 실제 앱의 `font-display`(교보손글씨) 사용.

## 9. 테스트

- **단위(Vitest):** 상태 순환 로직(중립→present→absent→중립, 사유 유무 → excused/unconfirmed)을 순수 함수로 뽑아 테스트. 반별 그룹핑.
- **통합(RLS):** viewer가 attendance_records INSERT/UPDATE 거부됨, editor 가능, 타 그룹 세션/레코드 안 보임, 세션 UNIQUE(group,date) 동작.
- **E2E(선택):** editor 로그인 → 오늘 세션 자동 생성 → 학생 present 체크 → 재조회 시 유지. (Plan 1 골든패스와 별개, 최소 스모크.)

## 10. 결정 사항 (재논의 금지 — 사용자 확정)
- ✅ 반별 탭(가로 스크롤), 반 없음 탭 자동.
- ✅ 탭 순환: 중립→출석→사유칸→노랑/빨강. 초기=중립(기록 없음).
- ✅ 목장 테마: 초록 배경·나무 울타리(얇은 진brown, 손그림)·나무 팻말(반이름 손글씨+선생님 기본폰트)·양떼 동그라미(귀 없음).
- ✅ 하루 1세션, 기본 "주일예배". viewer 읽기 전용.
- ✅ 범례 탭 아래/팻말 위. 색 = design-guide 팔레트.

## 11. 위험 · 주의 (`CLAUDE.md` 참조)
- 새 마이그레이션 번호는 `migration list` 확인 후(현재 마지막 `20260706000006`).
- 새 테이블 타입은 `database.types.ts` 수동 갱신(gen types 실패).
- Playwright 폼/탭 상호작용은 재시도 패턴.
- 낙관적 UI: 서버 실패 시 반드시 롤백 + 한국어 토스트.
