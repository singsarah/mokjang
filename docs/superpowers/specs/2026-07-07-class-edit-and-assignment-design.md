# 반 수정 · 반 배정 (Class edit & student assignment) — 설계

작성: 2026-07-07 · 대상 그룹: 학적부(Plan 2) 위 증분 기능 · 브랜치: `plan-2-student-roster`

## 목표
교사가 **반 관리 화면**에서 두 가지를 편하게 한다:
1. 이미 만든 반의 **이름·선생님**을 수정한다. (지금은 삭제만 가능)
2. 학생을 한 명씩 열지 않고, **명단을 보고 골라서** 반에 **넣고 뺀다**(다중 선택 일괄 이동).

## 현재 상태 (변경 전)
- `classes(id, group_id, name, teacher_name, display_order)` — 반은 이름+선생님, 학년 없음(반 중심 편성).
- `students.class_id` (nullable FK → classes.id) — 학생은 **한 반에만** 속함(또는 미배정 = null).
- 액션 `app/actions/classes.ts`: `createClass`(name+teacherName), `renameClass`(name만, UI 없음), `reorderClasses`(export만), `deleteClass`(빈 반만). **선생님 변경·다중 배정 없음.**
- 배정은 학생 상세(`settings/roster/[studentId]`)에서 한 명씩만 가능.
- `반 관리`(`settings/roster/classes/page.tsx`): 생성 폼 + 목록(빈 반에 삭제 버튼). 수정 UI 없음.
- `loadRoster()`(`lib/students.ts`): 그룹의 classes + students(각 classId 포함, viewer는 전화 마스킹) 반환. editor/master만 `canEdit`.

## 확정 결정
- **반 상세 화면**을 신설: 반 관리 목록에서 반을 탭 → `settings/roster/classes/[classId]`. 이 한 화면에서 **정보 수정 + 배정 + (빈 반) 삭제**를 모두 처리.
- 학생은 한 반만 → **"추가"는 이동**(다른 반에 있던 학생도 이 반으로 옮겨짐), **"빼기"는 미배정(class_id=null)**. 삭제(soft delete)와는 무관.
- **다중 선택 일괄 처리**: 추가 명단에서 여러 학생 체크 → "이 반에 추가" 한 번에 이동.
- 추가 명단에는 **이 반에 없는 모든 학생**(미배정 + 다른 반)을 표시하고, 각자의 **현재 반**을 라벨로 보여줌(미배정 학생을 위로 정렬).
- 반 정보 수정은 **학생 수와 무관하게 항상 가능**. 삭제만 빈 반 제한 유지.
- 권한: 쓰기 액션은 **master·editor만**, 전부 **그룹 범위 강제**. viewer는 이 화면 접근 시 `/settings/roster`로 리다이렉트(기존 `canEdit` 패턴).

## 화면
반 관리 목록: 각 반 행이 상세로 가는 **링크**가 된다(기존 인라인 삭제 버튼은 상세로 이동). 생성 폼은 그대로 목록 화면에 유지.

반 상세(`settings/roster/classes/[classId]`):
1. **반 정보** — 이름/선생님 입력 + 저장(서버 액션 폼). 저장 성공/실패 안내.
2. **이 반 학생 (N)** — 현재 이 반 학생 목록, 각 행에 `빼기`(→ 미배정).
3. **➕ 학생 추가** — 이 반에 없는 학생 체크박스 목록(각자 현재 반 라벨), 하단 `선택한 n명 이 반에 추가` 버튼. 선택 0명이면 비활성.
4. 빈 반이면 하단에 `삭제`.

배정(체크박스 다중 선택 + 즉시 반영 없이 버튼 제출)은 **클라이언트 컴포넌트**로 구현. 폼 제출은 서버 액션 사용, 낙관적 처리 불필요(제출 후 서버가 revalidate → 목록 갱신). 하이드레이션 함정 회피: 제출은 네이티브 `<form action={serverAction}>` 또는 `useActionState` 사용, 단일 `.click()` 의존 금지.

## 서버 액션 (신규/변경, `app/actions/classes.ts`)
- **`updateClass(input: { id: string; name: string; teacherName?: string | null }): Promise<{ error?: string }>`**
  - `renameClass`를 대체(이름 + 선생님). `classSchema`(name+teacherName)로 검증. `.eq("id").eq("group_id", m.groupId)` 로 update. 이름 중복(23505) → 한국어 안내.
- **`assignStudents(input: { studentIds: string[]; classId: string | null }): Promise<{ error?: string }>`**
  - "추가"(classId=대상 반)와 "빼기"(classId=null) 모두 처리.
  - editor 강제. `studentIds` 비면 `{}`(무동작). `classId`가 null이 아니면 **그 반이 이 그룹 소속인지 존재 검증**(타 그룹 class_id 방지 — 기존 미검증 갭 보완).
  - `update({ class_id: classId, updated_at: now })` `.in("id", studentIds)` `.eq("group_id", m.groupId)`. RLS(editor write, group scope)가 2차 방어.
  - `revalidatePath("/settings/roster")`, `revalidatePath("/settings/roster/classes")`, 상세 경로.
- `renameClass`는 제거(또는 `updateClass`로 흡수). `reorderClasses`는 그대로 두되 이번 범위 아님.

## 데이터/마이그레이션
- **스키마 변경 없음.** 기존 컬럼(`students.class_id`, `classes.teacher_name`)만 사용. 마이그레이션 불필요.

## 테스트
- **단위**: `classSchema`는 이미 커버. 신규 순수 로직 없음(액션은 DB 의존).
- **통합(RLS, `tests/integration/`)**: (a) editor가 `assignStudents`로 학생들의 class_id를 이 그룹 반으로/미배정으로 이동 가능; (b) **타 그룹 학생 id를 섞어도** 그 학생은 안 바뀜(그룹 스코프); (c) **타 그룹 classId로 배정 시도 거부**(존재 검증); (d) viewer 쓰기 차단; (e) `updateClass`가 이름+선생님 갱신·그룹 스코프. 액션 대신 RLS 레벨(직접 테이블 조작)로 검증하되, 그룹 스코프·존재검증은 액션 로직이므로 액션 직접 호출 테스트 1개 이상 포함 권장.
- **E2E(선택)**: 반 관리 → 반 상세 → 학생 2명 추가 → 목록에서 반별로 묶임 확인. 골든패스 무회귀.

## 검증(shipping bar)
`npm run typecheck && npm test && npm run test:e2e && npm run build` 4개 통과. dev 서버 끄고 build, Supabase 명령은 dangerouslyDisableSandbox.

## 범위 밖 (YAGNI)
드래그앤드롭, 반 순서변경 UI, 한 학생 다중 반 배정, 학생 상세의 기존 단건 배정 제거(그대로 둠).
