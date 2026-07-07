# Plan 5 — 학년·성별 + 배정목록 개선 + 진급 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 학생에 학년·성별을 기록하고, 반 배정 목록을 학년·학교·성별색으로 스캔하기 쉽게 하며, 버튼 한 번으로 전체 진급(3학년→졸업, 별도 졸업생 명단)을 처리한다.

**Architecture:** 토대(마이그레이션: gender·graduated_at·last_promoted_year 컬럼 + 원자적 진급 RPC `promote_group`) → 폼 필드 → 배정목록 표시 → 진급/졸업생 순으로 쌓는다. Plan 2~4 패턴 답습: 쿠키 유저 클라이언트 + `requireCurrentMembership` + RLS + `revalidatePath`, `database.types.ts` 수동 갱신, 클라이언트 폼은 `useTransition`.

**Tech Stack:** Next.js 15 (App Router, RSC + server actions + client component), Supabase (Postgres + RLS + RPC), Vitest, TypeScript, Tailwind.

**설계 문서:** `docs/superpowers/specs/2026-07-07-student-fields-and-promotion-design.md`

## Global Constraints
- 패키지 매니저 **npm**. 포트 **3100**. UI **한국어**.
- Supabase 닿는 명령(`npm test`, `test:e2e`, `db push`)은 **`dangerouslyDisableSandbox: true`**.
- 마이그레이션 push: `printf 'y\n' | npx supabase db push`. 새 번호는 **`npx supabase migration list --linked`로 마지막 확인 후 +1**(마지막 적용=`20260706000008`).
- `supabase gen types` 실패 → `lib/supabase/database.types.ts` **손으로 수정**.
- **모든 `SECURITY DEFINER` 함수는 `SET search_path = ''` + 스키마 정규화(`public.foo`) 필수.**
- 서버 액션은 요청 group_id 불신 → 현재 멤버십 `groupId` 강제. 쓰기 master·editor만. **진급은 master만.**
- `npm run build`는 dev 서버 끈 상태. 빌드 전 포트 3100 확인.
- 성별 매핑: `남`=`male`, `여`=`female`. 색: 여=핑크, 남=하늘, 미입력=중립.
- 커밋 끝에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## File Structure
**생성:** `supabase/migrations/20260707000001_student_fields_promotion.sql`, `app/(app)/settings/roster/graduated/page.tsx`, `components/promote-button.tsx`, `tests/integration/promotion-rls.test.ts`
**수정:** `lib/supabase/database.types.ts`, `lib/validation/student.ts`(gender), `lib/students.ts`(RosterStudent+active필터+loadGraduates), `app/actions/students.ts`(toRow gender + promoteGrades + restoreGraduate), `components/student-form.tsx`(학년·성별), `app/(app)/settings/roster/[studentId]/page.tsx`(initial.gender), `components/class-detail.tsx`(표시), `app/(app)/settings/roster/classes/[classId]/page.tsx`(props), `app/(app)/settings/roster/page.tsx`(진급 버튼+졸업생 링크)

---

## Task 1 (토대) — 마이그레이션 + 타입 + loadRoster + 통합 테스트

**Files:** Create `supabase/migrations/20260707000001_student_fields_promotion.sql`, `tests/integration/promotion-rls.test.ts`; Modify `lib/supabase/database.types.ts`, `lib/students.ts`

**Interfaces:**
- Produces: `students.gender`(text null, CHECK male/female), `students.graduated_at`(timestamptz null), `groups.last_promoted_year`(int null), RPC `promote_group(p_group_id uuid) returns void`. `RosterStudent`에 `school`·`gender` 추가. `loadRoster` active = `deleted_at is null AND graduated_at is null`. `loadGraduates()` 신규.

- [ ] **Step 1: 다음 마이그레이션 번호 확인**

Run (dangerouslyDisableSandbox): `npx supabase migration list --linked`
Expected: 마지막 `20260706000008`. 다음 파일명 `20260707000001_student_fields_promotion.sql`(충돌 시 +1).

- [ ] **Step 2: 통합 테스트 작성 (RPC 동작 고정)**

Create `tests/integration/promotion-rls.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, cleanup, createTestUser } from "./setup";

async function makeGroupWithRoles(joinCode: string) {
  const admin = adminClient();
  const master = await createTestUser();
  const editor = await createTestUser();
  const { data: group } = await admin
    .from("groups").insert({ name: "PROMO", join_code: joinCode, created_by: master.userId }).select("id").single();
  await admin.from("memberships").insert([
    { group_id: group!.id, user_id: master.userId, role: "master", status: "active" },
    { group_id: group!.id, user_id: editor.userId, role: "editor", status: "active" },
  ]);
  return { group: group!, master, editor };
}

describe("RLS/RPC: promotion", () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  it("promote_group bumps grades, graduates 3, keeps null; blocks second run same year; master-only", async () => {
    const { group, master, editor } = await makeGroupWithRoles("PROMO001");
    const admin = adminClient();
    await admin.from("students").insert([
      { group_id: group.id, name: "일학년", grade: 1 },
      { group_id: group.id, name: "이학년", grade: 2 },
      { group_id: group.id, name: "삼학년", grade: 3 },
      { group_id: group.id, name: "무학년", grade: null },
    ]);

    // editor는 진급 불가
    const asEditor = anonClient(editor.accessToken);
    const { error: eErr } = await asEditor.rpc("promote_group", { p_group_id: group.id });
    expect(eErr).not.toBeNull();

    // master 진급
    const asMaster = anonClient(master.accessToken);
    const { error: pErr } = await asMaster.rpc("promote_group", { p_group_id: group.id });
    expect(pErr).toBeNull();

    const { data: rows } = await admin
      .from("students").select("name, grade, graduated_at").eq("group_id", group.id);
    const by = Object.fromEntries((rows ?? []).map((r) => [r.name, r]));
    expect(by["일학년"].grade).toBe(2);
    expect(by["이학년"].grade).toBe(3);
    expect(by["삼학년"].graduated_at).not.toBeNull();
    expect(by["무학년"].grade).toBeNull();

    // 같은 해 재실행 차단
    const { error: p2 } = await asMaster.rpc("promote_group", { p_group_id: group.id });
    expect(p2).not.toBeNull();
  });
});
```

- [ ] **Step 3: 실행 → 실패 확인**

Run (dangerouslyDisableSandbox): `npx vitest run tests/integration/promotion-rls.test.ts`
Expected: FAIL — `function public.promote_group(...) does not exist` (또는 컬럼 없음).

- [ ] **Step 4: 마이그레이션 SQL 작성**

Create `supabase/migrations/20260707000001_student_fields_promotion.sql`:

```sql
ALTER TABLE students ADD COLUMN gender text CHECK (gender IN ('male','female'));
ALTER TABLE students ADD COLUMN graduated_at timestamptz;
ALTER TABLE groups ADD COLUMN last_promoted_year int;

CREATE INDEX idx_students_group_graduated ON students(group_id, graduated_at);

-- 진급: 전체 학년 +1, 3학년 졸업, master만, 같은 해 1회. 원자적.
CREATE OR REPLACE FUNCTION public.promote_group(p_group_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_year int := extract(year from now())::int;
BEGIN
  IF public.user_role_in_group(p_group_id, auth.uid()) IS DISTINCT FROM 'master' THEN
    RAISE EXCEPTION '진급은 대표 교사만 할 수 있습니다';
  END IF;
  IF (SELECT last_promoted_year FROM public.groups WHERE id = p_group_id) = v_year THEN
    RAISE EXCEPTION '올해 이미 진급했습니다';
  END IF;
  UPDATE public.students SET graduated_at = now()
    WHERE group_id = p_group_id AND grade = 3 AND deleted_at IS NULL AND graduated_at IS NULL;
  UPDATE public.students SET grade = grade + 1
    WHERE group_id = p_group_id AND grade IN (1,2) AND deleted_at IS NULL AND graduated_at IS NULL;
  UPDATE public.groups SET last_promoted_year = v_year WHERE id = p_group_id;
END;
$$;
```

- [ ] **Step 5: push**

Run (dangerouslyDisableSandbox): `printf 'y\n' | npx supabase db push`
Expected: `Applying migration 20260707000001_student_fields_promotion.sql...` 성공(edge-runtime 경고 무시).

- [ ] **Step 6: database.types.ts 수동 갱신**

Modify `lib/supabase/database.types.ts`:
1. `students` **Row**(약 78행)에 `deleted_at` 아래 `gender: string | null`, `graduated_at: string | null` 추가. **Insert**·**Update**에도 각각 `gender?: string | null`, `graduated_at?: string | null` 추가.
2. `groups` **Row**(약 265행)에 `last_promoted_year: number | null` 추가. **Insert**·**Update**에도 `last_promoted_year?: number | null` 추가.
3. `Functions`(약 372행) `find_group_by_code` 뒤에 추가:

```ts
      promote_group: {
        Args: { p_group_id: string }
        Returns: undefined
      }
```

- [ ] **Step 7: loadRoster 수정 + loadGraduates 추가**

Modify `lib/students.ts`:
1. `RosterStudent` 타입에 필드 추가: `school: string | null;` `gender: string | null;`
2. `loadRoster`의 students select에 `school, gender` 추가하고 active 필터에 `.is("graduated_at", null)` 추가. 매핑에 `school: s.school, gender: s.gender` 추가. (select 문자열: `"id, name, grade, class_id, birthday_month, phone_self, phone_guardian, guardian_relation, school, gender, deleted_at, graduated_at"`, 쿼리에 `.is("deleted_at", null).is("graduated_at", null)` — 단 `includeDeleted` 분기는 기존대로 deleted 조회 시 graduated 필터 미적용 유지.)
   - 정확히: 기존
     ```ts
     q = opts?.includeDeleted ? q.not("deleted_at", "is", null) : q.is("deleted_at", null);
     ```
     를 아래로 교체:
     ```ts
     q = opts?.includeDeleted
       ? q.not("deleted_at", "is", null)
       : q.is("deleted_at", null).is("graduated_at", null);
     ```
   - 매핑 객체에 `school: s.school,` 와 `gender: s.gender,` 추가.
3. 파일 끝에 `loadGraduates` 추가:

```ts
export async function loadGraduates(): Promise<{ canEdit: boolean; students: RosterStudent[] }> {
  const m = await requireCurrentMembership();
  const supabase = await createServerClient();
  const canEdit = m.role === "master" || m.role === "editor";
  const { data } = await supabase
    .from("students")
    .select("id, name, grade, class_id, birthday_month, phone_self, phone_guardian, guardian_relation, school, gender, deleted_at")
    .eq("group_id", m.groupId)
    .not("graduated_at", "is", null)
    .is("deleted_at", null)
    .order("name", { ascending: true });
  const mask = m.role === "viewer";
  const students: RosterStudent[] = (data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    grade: s.grade,
    classId: s.class_id,
    birthdayMonth: s.birthday_month,
    phoneSelf: mask ? maskPhone(s.phone_self) : s.phone_self,
    phoneGuardian: mask ? maskPhone(s.phone_guardian) : s.phone_guardian,
    guardianRelation: s.guardian_relation,
    school: s.school,
    gender: s.gender,
  }));
  return { canEdit, students };
}
```

- [ ] **Step 8: 통과 + typecheck**

Run (dangerouslyDisableSandbox): `npx vitest run tests/integration/promotion-rls.test.ts && npm run typecheck`
Expected: PASS + 클린.

- [ ] **Step 9: 커밋**

```bash
git add supabase/migrations/20260707000001_student_fields_promotion.sql lib/supabase/database.types.ts lib/students.ts tests/integration/promotion-rls.test.ts
git commit -m "Add gender/graduated_at/promotion migration + loadRoster (Plan 5 Task 1)"
```

---

## Task 2 — 학생 폼: 학년·성별 입력

**Files:** Modify `lib/validation/student.ts`, `app/actions/students.ts`, `components/student-form.tsx`, `app/(app)/settings/roster/[studentId]/page.tsx`

**Interfaces:**
- Consumes: `StudentInput`, `RosterStudent`(Task 1).
- Produces: `studentSchema`에 `gender`, `createStudent`/`updateStudent`가 gender 저장, 폼에 학년·성별 select.

- [ ] **Step 1: 스키마에 gender 추가**

Modify `lib/validation/student.ts` — `studentSchema` 객체에 필드 추가(예: `note` 다음 줄):

```ts
  gender: z.enum(["male", "female"]).nullish().transform((v) => v ?? null),
```

- [ ] **Step 2: 액션 toRow에 gender 추가**

Modify `app/actions/students.ts` — `toRow`의 반환 객체에 추가(예: `note: d.note,` 다음):

```ts
    gender: d.gender,
```

- [ ] **Step 3: 폼에 학년·성별 select 추가**

Modify `components/student-form.tsx`:
1. `Initial` 타입에 `gender: string | null;` 추가(예: `note` 다음).
2. `onSubmit`의 payload에서 `grade`를 폼 입력으로 바꾸고 gender 추가:
   - 기존 `grade: initial?.grade ?? null,` → `grade: formData.get("grade") ? Number(formData.get("grade")) : null,`
   - `photoPath,` 앞에 `gender: (formData.get("gender") as string) || null,` 추가.
3. "반" select 위에 학년 select, "학교" 아래 아무데나 성별 select 추가(라벨 패턴 동일, `className={input}`):

```tsx
      <label className="block">
        <span className="text-sm">학년</span>
        <select name="grade" defaultValue={initial?.grade ?? ""} className={input}>
          <option value="">선택 안 함</option>
          <option value="1">1학년</option>
          <option value="2">2학년</option>
          <option value="3">3학년</option>
        </select>
      </label>
      <label className="block">
        <span className="text-sm">성별</span>
        <select name="gender" defaultValue={initial?.gender ?? ""} className={input}>
          <option value="">선택 안 함</option>
          <option value="male">남</option>
          <option value="female">여</option>
        </select>
      </label>
```

- [ ] **Step 4: 학생 수정 페이지 initial에 gender 전달**

Modify `app/(app)/settings/roster/[studentId]/page.tsx` — `StudentForm`에 넘기는 `initial` 객체에 `gender: <student>.gender,` 추가(이 페이지가 학생 행을 읽어 initial을 구성하는 부분; grade 옆에 gender 추가). loadRoster/직접조회 어느 쪽이든 `gender` 필드가 포함되도록(직접 조회면 select에 `gender` 추가).

- [ ] **Step 5: 검증**

포트 3100 확인 후: Run `npm run typecheck && npm run build`
Expected: 클린 + 빌드 성공.

**동작 확인(사용자):** 학생 추가/수정 폼에 학년·성별 드롭다운 → 저장 → 다시 열면 값 유지.

- [ ] **Step 6: 커밋**

```bash
git add lib/validation/student.ts app/actions/students.ts components/student-form.tsx "app/(app)/settings/roster/[studentId]/page.tsx"
git commit -m "Add grade/gender inputs to student form (Plan 5 Task 2)"
```

---

## Task 3 — 반 배정 목록: 학년·학교·성별색 표시

**Files:** Modify `components/class-detail.tsx`, `app/(app)/settings/roster/classes/[classId]/page.tsx`

**Interfaces:** 변경 없음(표시만). Consumes: `RosterStudent`의 grade·school·gender(Task 1).

- [ ] **Step 1: 상세 페이지가 grade·school·gender를 props로 전달**

Modify `app/(app)/settings/roster/classes/[classId]/page.tsx` — `members`/`candidates` 매핑에 필드 추가:
- `members`: `.map((s) => ({ id: s.id, name: s.name, grade: s.grade, school: s.school, gender: s.gender }))`
- `candidates`: 기존 객체에 `grade: s.grade, school: s.school, gender: s.gender` 추가(정렬은 그대로 — 미배정 먼저 + `localeCompare(…, "ko")`).
- `members`도 이름 가나다 정렬 추가: `.sort((a, b) => a.name.localeCompare(b.name, "ko"))`.

- [ ] **Step 2: class-detail 표시 수정**

Modify `components/class-detail.tsx`:
1. `Member` 타입: `{ id: string; name: string; grade: number | null; school: string | null; gender: string | null }`.
2. `Candidate` 타입에 `grade: number | null; school: string | null; gender: string | null` 추가.
3. 성별 색 점 헬퍼(컴포넌트 함수 내부, return 전에):

```tsx
  const genderDot = (gender: string | null) =>
    gender === "female" ? "bg-pink-400" : gender === "male" ? "bg-sky-400" : "bg-transparent border border-border";
  const meta = (grade: number | null, school: string | null) =>
    [grade ? `${grade}학년` : null, school].filter(Boolean).join(" · ");
```

4. **멤버 항목** 렌더를 아래로 교체(이름 앞 성별 점 + 아래 학년·학교):

```tsx
              <li key={s.id} className="flex items-center justify-between rounded-card border border-border/60 bg-white p-3 shadow-sm">
                <span className="flex items-center gap-2">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${genderDot(s.gender)}`} />
                  <span className="text-ink">🐑 {s.name}
                    {meta(s.grade, s.school) && <span className="ml-1 text-xs text-ink-muted">{meta(s.grade, s.school)}</span>}
                  </span>
                </span>
                <button onClick={() => onRemove(s.id)} disabled={isPending} className="rounded-btn border border-border px-3 py-1 text-xs text-ink-muted transition hover:text-ink disabled:opacity-50">
                  빼기
                </button>
              </li>
```

5. **후보 항목** 렌더의 라벨 안을 아래로 교체(체크박스 + 성별 점 + 이름 + 학년·학교 + 현재 반):

```tsx
                  <label className="flex items-center gap-3 rounded-card border border-border/60 bg-white p-3 shadow-sm">
                    <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="h-4 w-4" />
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${genderDot(s.gender)}`} />
                    <span className="text-ink">{s.name}
                      {meta(s.grade, s.school) && <span className="ml-1 text-xs text-ink-muted">{meta(s.grade, s.school)}</span>}
                    </span>
                    <span className="ml-auto text-xs text-ink-muted">
                      {s.currentClassName ? `현재: ${s.currentClassName}` : "미배정"}
                    </span>
                  </label>
```

- [ ] **Step 3: 검증**

포트 3100 확인 후: Run `npm run typecheck && npm run build`
Expected: 클린 + 빌드 성공.

**동작 확인:** 반 상세의 학생·후보 목록에 성별 점(여 핑크/남 하늘/미입력 중립) + 학년·학교가 보이고, 미배정 먼저 + 가나다순.

- [ ] **Step 4: 커밋**

```bash
git add components/class-detail.tsx "app/(app)/settings/roster/classes/[classId]/page.tsx"
git commit -m "Show grade/school/gender in class assignment lists (Plan 5 Task 3)"
```

---

## Task 4 — 진급 버튼 + 졸업생 명단

**Files:** Create `components/promote-button.tsx`, `app/(app)/settings/roster/graduated/page.tsx`; Modify `app/actions/students.ts`, `app/(app)/settings/roster/page.tsx`

**Interfaces:**
- Consumes: RPC `promote_group`(Task 1), `loadGraduates`(Task 1).
- Produces: `promoteGrades()`·`restoreGraduate({id})` 액션, 진급 버튼, 졸업생 페이지.

- [ ] **Step 1: 진급/복원 액션 추가**

Modify `app/actions/students.ts` — 파일 끝에 추가:

```ts
export async function promoteGrades(): Promise<{ error?: string }> {
  const m = await requireCurrentMembership();
  if (m.role !== "master") return { error: "진급은 대표 교사만 할 수 있습니다" };
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("promote_group", { p_group_id: m.groupId });
  if (error) return { error: error.message };
  revalidatePath("/settings/roster");
  revalidatePath("/settings/roster/graduated");
  return {};
}

export async function restoreGraduate(input: { id: string }): Promise<{ error?: string }> {
  const m = await requireEditor();
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("students")
    .update({ graduated_at: null })
    .eq("id", input.id)
    .eq("group_id", m.groupId);
  if (error) return { error: error.message };
  revalidatePath("/settings/roster");
  revalidatePath("/settings/roster/graduated");
  return {};
}
```

(파일 상단 import에 `requireCurrentMembership`이 이미 있음 — 확인. 없으면 추가.)

- [ ] **Step 2: 진급 버튼 클라이언트 컴포넌트**

Create `components/promote-button.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { promoteGrades } from "@/app/actions/students";

export function PromoteButton() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function onClick() {
    if (!confirm("모든 학생의 학년을 1씩 올립니다. 3학년은 졸업 처리되어 명단에서 빠집니다. 진행할까요?")) return;
    setError(undefined);
    startTransition(async () => {
      const result = await promoteGrades();
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-end">
      <button
        onClick={onClick}
        disabled={isPending}
        className="rounded-btn border border-sage px-3 py-1 text-xs text-sage-deep transition hover:bg-sage-soft disabled:opacity-50"
      >
        {isPending ? "진급 중..." : "학년 올리기"}
      </button>
      {error && <span className="mt-1 text-xs text-danger">{error}</span>}
    </span>
  );
}
```

- [ ] **Step 3: 학적부에 진급 버튼 + 졸업생 링크**

Modify `app/(app)/settings/roster/page.tsx`:
1. import 추가: `import { PromoteButton } from "@/components/promote-button";`
2. 상단 헤더(학적부 제목 + "학생 추가" 버튼 있는 `flex` 영역)에서, master(`canEdit`만으론 부족 — 이 페이지는 role을 직접 모름)에게 진급 버튼 노출. `loadRoster`는 role을 반환하지 않으므로 `requireCurrentMembership`으로 role 확인:
   - 상단에 `import { requireCurrentMembership } from "@/lib/memberships";` 추가, 컴포넌트에서 `const m = await requireCurrentMembership();` 호출, `const isMaster = m.role === "master";`.
   - "학생 추가" Link 옆(같은 flex, canEdit && isMaster 조건)에 `<PromoteButton />` 렌더.
3. "반 관리"·"숨김 학생" 링크 줄에 졸업생 링크 추가:

```tsx
          <Link
            href="/settings/roster/graduated"
            className="rounded-tag bg-white px-3 py-1 text-ink-muted shadow-sm hover:text-ink"
          >
            졸업생
          </Link>
```

- [ ] **Step 4: 졸업생 페이지**

Create `app/(app)/settings/roster/graduated/page.tsx`:

```tsx
import Link from "next/link";
import { loadGraduates } from "@/lib/students";
import { restoreGraduate } from "@/app/actions/students";

export default async function GraduatedPage() {
  const { canEdit, students } = await loadGraduates();

  return (
    <main className="min-h-screen bg-card pb-24">
      <div className="mx-auto max-w-md px-6 py-8">
        <Link href="/settings/roster" className="text-sm text-ink-muted hover:text-ink">
          ← 학적부
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-ink">졸업생</h1>
        <p className="mt-1 text-sm text-ink-muted">진급 때 3학년이 졸업 처리된 학생입니다. 복원하면 3학년으로 학적부에 돌아갑니다.</p>

        {students.length === 0 ? (
          <p className="mt-12 text-center text-ink-muted">아직 졸업생이 없어요 🎓</p>
        ) : (
          <ul className="mt-6 space-y-2">
            {students.map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded-card border border-border/60 bg-white p-3 shadow-sm">
                <span className="text-ink">🎓 {s.name}</span>
                {canEdit && (
                  <form action={async () => { "use server"; await restoreGraduate({ id: s.id }); }}>
                    <button className="rounded-btn border border-border px-3 py-1 text-xs text-ink-muted transition hover:text-ink">
                      복원
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 5: 검증**

포트 3100 확인 후: Run `npm run typecheck && npm run build`
Expected: 클린 + 빌드 성공. `/settings/roster/graduated` = ƒ.

**동작 확인(사용자):** 학적부에서 master가 "학년 올리기" → 확인 → 전체 학년 +1, 3학년은 졸업생 명단으로. 같은 해 다시 누르면 "올해 이미 진급했습니다". 졸업생 페이지에서 복원 → 3학년으로 학적부 복귀.

- [ ] **Step 6: 커밋**

```bash
git add app/actions/students.ts components/promote-button.tsx "app/(app)/settings/roster/graduated/page.tsx" "app/(app)/settings/roster/page.tsx"
git commit -m "Add grade promotion + graduates list (Plan 5 Task 4)"
```

---

## 최종 검증 (Plan 5 완료)
- [ ] 포트 3100 확인 후 순차(모두 dangerouslyDisableSandbox):
```bash
rm -rf .next
npm run typecheck
npm test
npx playwright test
npm run build
```
Expected: typecheck 클린 · vitest 전부 PASS(기존 + promotion-rls) · Playwright 5/5(무회귀) · build 성공.
- [ ] 동작 확인(사용자): 학년·성별 입력 → 배정 목록 색/정보 → 진급 → 졸업생 복원.

---

## Self-Review (writing-plans)

**1. Spec coverage:**
- 학년 폼 입력 → Task 2 ✅ · 성별 컬럼+폼 → Task 1(컬럼)·Task 2(폼) ✅
- 배정목록 학년·학교·성별색·정렬 → Task 3 ✅
- 진급(1→2,2→3,3→졸업, RPC 원자적, master만, 연도 가드) → Task 1(RPC)·Task 4(액션·버튼) ✅
- 졸업생 별도 명단 + 복원 → Task 1(loadGraduates)·Task 4(페이지·restoreGraduate) ✅
- 마이그레이션(gender·graduated_at·last_promoted_year·RPC) + 타입 → Task 1 ✅
- loadRoster active에 graduated 제외 → Task 1 ✅
- SECURITY DEFINER search_path 규칙 → Task 1 RPC ✅

**2. Placeholder scan:** 마이그레이션 번호만 구현 시 확인(명시). 나머지 실제 코드. ✅

**3. Type consistency:** `gender: string|null`(RosterStudent·Initial·Member·Candidate), `promote_group` Args `{p_group_id:string}`(types·action·RPC 일치), `promoteGrades()`/`restoreGraduate({id})`(Task 4 정의 = Task 4 버튼/페이지 사용), `loadGraduates` 반환 `{canEdit, students}`(Task1 정의 = Task4 페이지 사용). studentSchema.gender enum male/female = 폼 option value male/female = DB CHECK male/female. ✅

**주의(구현 순서):** Task 1 → 2 → 3 → 4. 2·3은 Task 1 컬럼/타입, 4는 Task 1 RPC/loadGraduates 의존.
```
