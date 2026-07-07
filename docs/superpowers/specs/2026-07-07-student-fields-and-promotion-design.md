# 학년·성별 필드 + 배정목록 개선 + 진급(학년 올리기) — 설계 (Plan 5)

작성: 2026-07-07 · 브랜치: `plan-2-student-roster` · Plan 2~4 위 증분

## 목표
1. **학생 정보에 학년·성별을 기록**한다. (학년은 DB에 이미 있으나 폼에서 입력을 안 받는 상태 → 되살림. 성별은 신규.)
2. **반 배정 목록을 스캔하기 쉽게** — 이름 옆에 학년·학교, 성별을 색으로(여=핑크/남=하늘), 정렬 개선.
3. **진급(학년 올리기)** — 버튼 한 번으로 전체 학년 +1, 3학년은 졸업 처리(별도 졸업생 명단 보관, 복원 가능), 실수 방지 가드.

## 현재 상태 (변경 전)
- `students`: `grade`(int, nullable — 폼에서 미입력, 기존 코드 주석 "반 중심"), `school`(text), `class_id`, `deleted_at`(숨김), 등. **성별·졸업 개념 없음.**
- `studentSchema`(`lib/validation/student.ts`): grade는 `optionalInt(1,6)`로 이미 존재. gender 없음.
- `StudentForm`(`components/student-form.tsx`): 학년 입력칸 없음(기존 grade 값 보존만). 성별 없음.
- `loadRoster`(`lib/students.ts`): active = `deleted_at is null`. `RosterStudent`에 grade는 있으나 school·gender 없음.
- 학생 액션(`app/actions/students.ts`): create/update(toRow), softDelete/restore(숨김). 진급 없음.
- 학적부(`settings/roster/page.tsx`): "반 관리"·"숨김 학생" 링크. 진급 버튼 없음. 반 배정 목록은 `settings/roster/classes/[classId]` + `components/class-detail.tsx`.
- 그룹 코드용 RPC `find_group_by_code` 존재(RPC 패턴 참고).

## 확정 결정
### 학년
- 학생 추가/수정 폼에 **학년 드롭다운(1/2/3학년, "선택 안 함" 포함)**. 값은 기존 `students.grade` 사용(범위 1~3만 실제 사용). 학적부·배정 목록에 표시.

### 성별
- `students.gender` **신규 컬럼**: text, nullable, `CHECK (gender IN ('male','female'))`. 기존 학생은 null(미입력) — 편집 시 채움.
- 폼에 **성별 드롭다운(남/여 + "선택 안 함")**. `남`=male, `여`=female.
- 표시 색: **여=핑크, 남=하늘**. 값이 null이면 색 없음(중립).

### 반 배정 목록 개선 (`class-detail.tsx`)
- 후보/멤버 학생 항목에 **이름 + 학년·학교**(있는 것만, 예: "2학년 · OO고") 표시.
- 이름 옆 **성별 색 점/칩**(여 핑크·남 하늘·미입력 중립).
- 정렬: **"미배정 먼저" 규칙 유지**, 각 그룹(미배정/다른 반) 안에서 **이름 가나다순**(`localeCompare(…, "ko")`). 멤버 목록도 가나다.

### 진급(학년 올리기)
- 학적부 상단에 **"학년 올리기(진급)" 버튼 — master만** 표시.
- 누르면 **확인창**: "모든 학생의 학년을 1씩 올립니다. 3학년은 졸업 처리되어 명단에서 빠집니다. 진행할까요?"
- 실행(원자적, 아래 RPC): active 학생(숨김·졸업 제외) 중 **grade 1→2, 2→3**, **grade 3→졸업**(=`graduated_at` 세팅), grade null은 그대로.
- **졸업 = `students.graduated_at`(신규 timestamptz nullable)** 세팅. 활성 학적부에서 빠지고 **별도 "졸업생" 명단**에 표시. **복원**(졸업생→학적부) 가능(= graduated_at을 null로; 이때 grade는 3으로 남음).
- **실수 방지 가드**: `groups.last_promoted_year`(신규 int nullable)에 진급 연도 기록. 같은 해에 다시 누르면 **"올해 이미 진급했습니다"** 거부.
- 연도 계산은 **서버 시각 기준 연도**(RPC에서 `extract(year from now())`).

## 데이터/마이그레이션 (신규 1개)
`supabase/migrations/<다음번호>_student_fields_promotion.sql` (번호는 `npx supabase migration list --linked`로 마지막 확인 후 +1; 마지막 적용=`20260706000008`):
- `ALTER TABLE students ADD COLUMN gender text CHECK (gender IN ('male','female'));`
- `ALTER TABLE students ADD COLUMN graduated_at timestamptz;`
- `ALTER TABLE groups ADD COLUMN last_promoted_year int;`
- (선택) `CREATE INDEX idx_students_group_graduated ON students(group_id, graduated_at);`
- **RPC `promote_group(p_group_id uuid)`** — `SECURITY DEFINER`, `SET search_path = ''`, 스키마 정규화(`public.…`) 필수(CLAUDE.md 규칙):
  - `public.user_role_in_group(p_group_id, auth.uid()) = 'master'` 아니면 `raise exception`(권한).
  - `public.groups.last_promoted_year = extract(year from now())` 이면 `raise exception '올해 이미 진급했습니다'`.
  - `UPDATE public.students SET graduated_at = now() WHERE group_id = p_group_id AND grade = 3 AND deleted_at IS NULL AND graduated_at IS NULL;`
  - `UPDATE public.students SET grade = grade + 1 WHERE group_id = p_group_id AND grade IN (1,2) AND deleted_at IS NULL AND graduated_at IS NULL;`
  - `UPDATE public.groups SET last_promoted_year = extract(year from now()) WHERE id = p_group_id;`
  - (졸업 UPDATE를 grade+1 UPDATE보다 **먼저** 실행 — 순서 중요.)
- `lib/supabase/database.types.ts` **수동 갱신**(gen types 이 머신 불가): students Row/Insert/Update에 `gender`, `graduated_at` 추가, groups에 `last_promoted_year` 추가, Functions에 `promote_group: { Args: { p_group_id: string }, Returns: undefined }` 추가.

## 코드 변경
- `lib/validation/student.ts`: `gender: z.enum(["male","female"]).nullish().transform(v=>v??null)` 추가.
- `app/actions/students.ts`: `toRow`에 `gender` 추가. 신규 `promoteGrades(): Promise<{error?:string}>` — requireCurrentMembership → master 아니면 에러 → `supabase.rpc("promote_group", { p_group_id: m.groupId })` → 에러 메시지 전달 → revalidate. 신규 `restoreGraduate(input:{id}): Promise<{error?:string}>`(= graduated_at null, 그룹 스코프, 패턴은 restoreStudent와 동일).
- `lib/students.ts`: `RosterStudent`에 `school`, `gender` 추가. active 쿼리 `.is("deleted_at", null).is("graduated_at", null)`. 신규 `loadGraduates()`(또는 loadRoster 옵션) → 졸업생 목록(graduated_at not null).
- `components/student-form.tsx`: 학년 select(1/2/3) + 성별 select(남/여) 추가, onSubmit payload에 grade·gender 포함(현재 grade는 initial 보존만 → 폼 입력으로).
- `components/class-detail.tsx`: `Member`/`Candidate`에 grade·school·gender 추가, 표시(학년·학교 + 성별 색), 정렬 유지(미배정 먼저 + 가나다).
- `app/(app)/settings/roster/page.tsx`: master면 "학년 올리기(진급)" 버튼(확인 후 `promoteGrades`) + "졸업생" 링크 추가. (진급 버튼은 확인창 필요 → 작은 클라이언트 컴포넌트.)
- 신규 `app/(app)/settings/roster/graduated/page.tsx`: 졸업생 목록 + 복원(restoreGraduate). 숨김 학생 페이지 패턴 재사용.

## 테스트
- **단위**: gender 스키마(남/여/미입력) 파싱. (grade는 기존 커버.)
- **통합(RLS/RPC)**: (a) `promote_group`가 grade 1→2·2→3·3→졸업(graduated_at)·null 유지; (b) 같은 해 재실행 시 예외("올해 이미 진급"); (c) **비-master(editor)** 호출 시 예외; (d) 타 그룹 학생 미영향; (e) gender/graduated_at 컬럼 RLS(editor write, viewer read) 정상. RPC는 직접 호출로 검증.
- **E2E(선택)**: 학생에 학년·성별 입력 → 배정 목록에 표시/색 확인. 골든패스 무회귀.

## 검증(shipping bar)
`npm run typecheck && npm test && npm run test:e2e && npm run build` 4개 통과. dev 끄고 build, Supabase 명령은 dangerouslyDisableSandbox. 마이그레이션 push: `printf 'y\n' | npx supabase db push`.

## 범위 밖 (YAGNI)
진급 되돌리기(undo) 버튼(졸업 복원은 있으나 학년 일괄 -1은 없음 — 가드로 실수 방지), 성별 3번째 값, 학년 4~6 UI, 졸업생 통계.
