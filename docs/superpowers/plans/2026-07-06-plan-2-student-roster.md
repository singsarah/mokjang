# Plan 2 — 학적부 (학생 명단) Implementation Plan · 하이브리드(vertical slice) 구성

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 교사가 학생 명단을 손으로 관리(추가·수정·소프트 삭제·복원)하고 반을 관리하는 기능을 만든다. 조회 교사에게는 연락처를 마스킹한다.

**Architecture:** **토대(데이터+RLS)를 먼저 한 번에 세운 뒤, 그 위를 vertical slice로 쌓는다.** 각 슬라이스는 데이터→액션→화면까지 얇게 끝까지 완성해 그 자체로 동작을 확인할 수 있다. Plan 1 패턴 답습: Supabase 마이그레이션 + `lib/supabase/database.types.ts` 수동 갱신, Zod 검증, `app/actions/*` 서버 액션(쿠키 유저 클라이언트 + `requireCurrentMembership` + `revalidatePath`), `app/(app)/settings/roster/*` 서버 컴포넌트 + 클라이언트 폼. 순수 로직은 Vitest 단위, RLS는 dev DB 통합 테스트, 페이지는 typecheck+build.

**Tech Stack:** Next.js 15 (App Router, RSC + server actions), Supabase (Postgres + RLS), Zod v4, Vitest, TypeScript.

**설계 문서:** `docs/superpowers/specs/2026-07-06-plan-2-student-roster-design.md`

## 왜 하이브리드인가 (구현자 참고)
- **토대(Task 1)만 한 번에:** 학생/반 스키마는 설계에서 완전히 확정됨 → 슬라이스마다 컬럼을 쪼개 넣으면 마이그레이션이 지저분해지므로 테이블·RLS는 처음 한 방에.
- **그 위는 slice로:** 화면과 폼은 처음부터 "반 지원 가능(class_id nullable)"·"마스킹 자리 비움" 상태로 만들어, 이후 슬라이스가 **기존 파일을 조금씩 확장**하도록 설계했다.
  - Slice 1 끝 → 학생 추가/목록이 **실제로 동작**(사용자 확인 지점 🎉)
  - Slice 2 → 수정/삭제/복원
  - Slice 3 → 반 생성 (폼의 반 드롭다운·목록의 반 그룹핑은 Slice 1에서 이미 준비됨 → 최소 수정)
  - Slice 4 → viewer 연락처 마스킹 (loadRoster 한 곳만 수정)

## Global Constraints

- 패키지 매니저 **npm 고정**. 개발 포트 **3100**. UI 텍스트 **한국어**.
- Supabase에 닿는 명령(`npm test`, `supabase db push`, curl)은 **`dangerouslyDisableSandbox: true`**.
- 마이그레이션 push: `printf 'y\n' | npx supabase db push`.
- 새 마이그레이션 번호는 `npx supabase migration list --linked` 로 마지막 번호 확인 후 부여(가정: `20260706000001`).
- `supabase gen types` 는 이 머신에서 실패 → `database.types.ts` **수동 갱신**.
- 서버 액션은 요청 `group_id` 를 신뢰하지 않고 **현재 멤버십의 `groupId`** 로 강제. 쓰기는 **master·editor** 만.
- **`npm run build` 는 dev 서버 종료 후** 실행(포트 3100 확인). Playwright 폼 제출은 단일 클릭 금지(재시도 패턴).
- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File Structure

**생성:**
- `supabase/migrations/20260706000001_student_roster.sql`
- `lib/validation/student.ts` (Slice 1: studentSchema / Slice 3: classSchema 추가)
- `lib/students.ts` (Slice 1: loadRoster / Slice 4: maskPhone + 적용)
- `app/actions/students.ts` (Slice 1: create / Slice 2: update·delete·restore)
- `app/actions/classes.ts` (Slice 3)
- `components/student-form.tsx` (Slice 1)
- `app/(app)/settings/roster/page.tsx` (Slice 1)
- `app/(app)/settings/roster/new/page.tsx` (Slice 1)
- `app/(app)/settings/roster/[studentId]/page.tsx` (Slice 2)
- `app/(app)/settings/roster/hidden/page.tsx` (Slice 2)
- `app/(app)/settings/roster/classes/page.tsx` (Slice 3)
- 테스트: `tests/integration/roster-rls.test.ts` (Task 1), `tests/unit/student-schema.test.ts` (Slice 1), `tests/integration/roster-soft-delete.test.ts` (Slice 2), `tests/unit/mask-phone.test.ts` (Slice 4)

**수정:**
- `lib/supabase/database.types.ts` (Task 1)
- `app/(app)/settings/page.tsx` (Slice 1: 학적부 링크)

---

## Task 1 (토대): 마이그레이션 — classes/students + RLS + 타입

**Files:**
- Create: `supabase/migrations/20260706000001_student_roster.sql`, `tests/integration/roster-rls.test.ts`
- Modify: `lib/supabase/database.types.ts`

**Interfaces:**
- Produces: `classes`(`id, group_id, grade, name, display_order, created_at`), `students`(`id, group_id, class_id, name, grade, birthday_month/day/year, phone_self, phone_guardian, guardian_relation, deleted_at, created_at, updated_at`). RLS: 활성 멤버 read, master·editor write. Plan 1 헬퍼 `is_active_member`/`user_role_in_group` 재사용.

- [ ] **Step 1: 다음 마이그레이션 번호 확인**

Run (dangerouslyDisableSandbox): `npx supabase migration list --linked`
Expected: 마지막 `20260703000005`. 다음으로 `20260706000001` 사용.

- [ ] **Step 2: RLS 통합 테스트 작성 (실패 예정)**

Create `tests/integration/roster-rls.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, cleanup, createTestUser } from "./setup";

async function makeGroupWithRoles(joinCode: string) {
  const admin = adminClient();
  const master = await createTestUser();
  const editor = await createTestUser();
  const viewer = await createTestUser();
  const { data: group } = await admin
    .from("groups")
    .insert({ name: "R", join_code: joinCode, created_by: master.userId })
    .select("id")
    .single();
  await admin.from("memberships").insert([
    { group_id: group!.id, user_id: master.userId, role: "master", status: "active" },
    { group_id: group!.id, user_id: editor.userId, role: "editor", status: "active" },
    { group_id: group!.id, user_id: viewer.userId, role: "viewer", status: "active" },
  ]);
  return { group: group!, master, editor, viewer };
}

describe("RLS: students / classes", () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  it("editor can insert a student; viewer cannot", async () => {
    const { group, editor, viewer } = await makeGroupWithRoles("ROST0001");
    const asEditor = anonClient(editor.accessToken);
    const { data: inserted, error: eErr } = await asEditor
      .from("students")
      .insert({ group_id: group.id, name: "홍길동", grade: 1 })
      .select("id")
      .single();
    expect(eErr).toBeNull();
    expect(inserted?.id).toBeTruthy();

    const asViewer = anonClient(viewer.accessToken);
    await asViewer.from("students").insert({ group_id: group.id, name: "차단", grade: 1 });
    const admin = adminClient();
    const { data: rows } = await admin.from("students").select("name").eq("group_id", group.id);
    expect(rows?.map((r) => r.name).sort()).toEqual(["홍길동"]);
  });

  it("viewer can read students; other group cannot", async () => {
    const a = await makeGroupWithRoles("ROST0002");
    const b = await makeGroupWithRoles("ROST0003");
    const admin = adminClient();
    await admin.from("students").insert({ group_id: a.group.id, name: "A학생", grade: 2 });

    const asViewerA = anonClient(a.viewer.accessToken);
    const { data: seenByA } = await asViewerA.from("students").select("name");
    expect(seenByA?.map((r) => r.name)).toContain("A학생");

    const asMasterB = anonClient(b.master.accessToken);
    const { data: seenByB } = await asMasterB.from("students").select("name");
    expect(seenByB ?? []).toEqual([]);
  });
});
```

- [ ] **Step 3: 테스트 실행 → 실패 확인**

Run (dangerouslyDisableSandbox): `npx vitest run tests/integration/roster-rls.test.ts`
Expected: FAIL — `relation "public.students" does not exist`.

- [ ] **Step 4: 마이그레이션 SQL 작성**

Create `supabase/migrations/20260706000001_student_roster.sql`:

```sql
CREATE TABLE classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  grade int NOT NULL,
  name text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, grade, name)
);

CREATE TABLE students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  name text NOT NULL,
  grade int NOT NULL,
  birthday_month int,
  birthday_day int,
  birthday_year int,
  phone_self text,
  phone_guardian text,
  guardian_relation text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_students_group_deleted ON students(group_id, deleted_at);
CREATE INDEX idx_classes_group ON classes(group_id, grade, display_order);

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read classes" ON classes FOR SELECT
  USING (is_active_member(group_id, auth.uid()));
CREATE POLICY "members read students" ON students FOR SELECT
  USING (is_active_member(group_id, auth.uid()));

CREATE POLICY "editors write classes" ON classes FOR ALL
  USING (user_role_in_group(group_id, auth.uid()) IN ('master','editor'))
  WITH CHECK (user_role_in_group(group_id, auth.uid()) IN ('master','editor'));
CREATE POLICY "editors write students" ON students FOR ALL
  USING (user_role_in_group(group_id, auth.uid()) IN ('master','editor'))
  WITH CHECK (user_role_in_group(group_id, auth.uid()) IN ('master','editor'));
```

- [ ] **Step 5: push**

Run (dangerouslyDisableSandbox): `printf 'y\n' | npx supabase db push`
Expected: `Applying migration 20260706000001_student_roster.sql...` 성공.

- [ ] **Step 6: database.types.ts 수동 갱신**

Modify `lib/supabase/database.types.ts` — `public.Tables` 안(예: `audit_log` 앞)에 두 블록 추가:

```ts
      classes: {
        Row: {
          created_at: string
          display_order: number
          grade: number
          group_id: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          grade: number
          group_id: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          display_order?: number
          grade?: number
          group_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          birthday_day: number | null
          birthday_month: number | null
          birthday_year: number | null
          class_id: string | null
          created_at: string
          deleted_at: string | null
          grade: number
          group_id: string
          guardian_relation: string | null
          id: string
          name: string
          phone_guardian: string | null
          phone_self: string | null
          updated_at: string
        }
        Insert: {
          birthday_day?: number | null
          birthday_month?: number | null
          birthday_year?: number | null
          class_id?: string | null
          created_at?: string
          deleted_at?: string | null
          grade: number
          group_id: string
          guardian_relation?: string | null
          id?: string
          name: string
          phone_guardian?: string | null
          phone_self?: string | null
          updated_at?: string
        }
        Update: {
          birthday_day?: number | null
          birthday_month?: number | null
          birthday_year?: number | null
          class_id?: string | null
          created_at?: string
          deleted_at?: string | null
          grade?: number
          group_id?: string
          guardian_relation?: string | null
          id?: string
          name?: string
          phone_guardian?: string | null
          phone_self?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
```

- [ ] **Step 7: 테스트 통과 + typecheck**

Run (dangerouslyDisableSandbox): `npx vitest run tests/integration/roster-rls.test.ts && npm run typecheck`
Expected: PASS + 클린.

- [ ] **Step 8: 커밋**

```bash
git add supabase/migrations/20260706000001_student_roster.sql lib/supabase/database.types.ts tests/integration/roster-rls.test.ts
git commit -m "Add classes/students tables with RLS (Plan 2 Task 1)"
```

---

## Slice 1: 학생 추가 + 목록 보기 (end-to-end, 첫 동작 확인 지점 🎉)

목표: master/editor가 설정→학적부에서 **학생을 추가하면 목록에 뜬다.** 반은 아직 만들 수 없으니 "반 없음"으로만, 마스킹도 아직 없음. 목록/폼은 **처음부터 반·마스킹 확장 가능한 구조**로 만든다.

**Files:**
- Create: `lib/validation/student.ts`, `lib/students.ts`, `app/actions/students.ts`, `components/student-form.tsx`, `app/(app)/settings/roster/page.tsx`, `app/(app)/settings/roster/new/page.tsx`, `tests/unit/student-schema.test.ts`
- Modify: `app/(app)/settings/page.tsx`

**Interfaces:**
- Produces:
  - `studentSchema` + `type StudentInput = { name: string; grade: number; classId: string | null; birthdayMonth: number|null; birthdayDay: number|null; birthdayYear: number|null; phoneSelf: string|null; phoneGuardian: string|null; guardianRelation: "모"|"부"|"기타"|null }`
  - `createStudent(input: StudentInput): Promise<{ error?: string; id?: string }>`
  - `type RosterClass = { id: string; grade: number; name: string; displayOrder: number }`
  - `type RosterStudent = { id: string; name: string; grade: number; classId: string|null; phoneSelf: string|null; phoneGuardian: string|null; guardianRelation: string|null }`
  - `loadRoster(opts?: { includeDeleted?: boolean }): Promise<{ canEdit: boolean; classes: RosterClass[]; students: RosterStudent[] }>` (Slice 1: 마스킹 없음)
  - `StudentForm` 클라이언트 컴포넌트

- [ ] **Step 1: 스키마 단위 테스트 (실패 예정)**

Create `tests/unit/student-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { studentSchema } from "@/lib/validation/student";

describe("studentSchema", () => {
  it("accepts a minimal valid student", () => {
    expect(studentSchema.safeParse({ name: "김철수", grade: 1 }).success).toBe(true);
  });
  it("rejects empty name", () => {
    expect(studentSchema.safeParse({ name: "", grade: 1 }).success).toBe(false);
  });
  it("rejects birthday_month out of range", () => {
    expect(studentSchema.safeParse({ name: "A", grade: 1, birthdayMonth: 13 }).success).toBe(false);
  });
  it("coerces optional blanks to null", () => {
    expect(studentSchema.parse({ name: "A", grade: 2, phoneSelf: "" }).phoneSelf).toBeNull();
  });
  it("rejects invalid guardian relation", () => {
    expect(studentSchema.safeParse({ name: "A", grade: 1, guardianRelation: "삼촌" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: 실행 → 실패 확인**

Run: `npx vitest run tests/unit/student-schema.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 스키마 구현**

Create `lib/validation/student.ts`:

```ts
import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullish()
  .transform((v) => v ?? null);

const optionalInt = (min: number, max: number) =>
  z.coerce.number().int().min(min).max(max).nullish().transform((v) => v ?? null);

export const studentSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해주세요").max(50),
  grade: z.coerce.number().int().min(1, "학년을 선택해주세요").max(6),
  classId: z.string().uuid().nullish().transform((v) => v ?? null),
  birthdayMonth: optionalInt(1, 12),
  birthdayDay: optionalInt(1, 31),
  birthdayYear: optionalInt(1900, 2100),
  phoneSelf: optionalText,
  phoneGuardian: optionalText,
  guardianRelation: z.enum(["모", "부", "기타"]).nullish().transform((v) => v ?? null),
});

export type StudentInput = z.infer<typeof studentSchema>;
```

- [ ] **Step 4: 실행 → 통과**

Run: `npx vitest run tests/unit/student-schema.test.ts`
Expected: PASS.

- [ ] **Step 5: createStudent 액션 구현**

Create `app/actions/students.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership, type CurrentMembership } from "@/lib/memberships";
import { studentSchema, type StudentInput } from "@/lib/validation/student";

async function requireEditor(): Promise<CurrentMembership> {
  const m = await requireCurrentMembership();
  if (m.role !== "master" && m.role !== "editor") throw new Error("편집 권한이 필요합니다");
  return m;
}

function toRow(d: StudentInput) {
  return {
    name: d.name,
    grade: d.grade,
    class_id: d.classId,
    birthday_month: d.birthdayMonth,
    birthday_day: d.birthdayDay,
    birthday_year: d.birthdayYear,
    phone_self: d.phoneSelf,
    phone_guardian: d.phoneGuardian,
    guardian_relation: d.guardianRelation,
  };
}

export async function createStudent(
  input: StudentInput,
): Promise<{ error?: string; id?: string }> {
  const parsed = studentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const m = await requireEditor();
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("students")
    .insert({ group_id: m.groupId, ...toRow(parsed.data) })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/settings/roster");
  return { id: data.id };
}
```

> 참고: `requireEditor`·`toRow` 는 Slice 2가 이 파일에 update/delete/restore를 추가할 때 재사용한다.

- [ ] **Step 6: loadRoster 구현 (마스킹 없음)**

Create `lib/students.ts`:

```ts
import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership } from "@/lib/memberships";

export type RosterClass = { id: string; grade: number; name: string; displayOrder: number };
export type RosterStudent = {
  id: string;
  name: string;
  grade: number;
  classId: string | null;
  phoneSelf: string | null;
  phoneGuardian: string | null;
  guardianRelation: string | null;
};

export async function loadRoster(opts?: { includeDeleted?: boolean }): Promise<{
  canEdit: boolean;
  classes: RosterClass[];
  students: RosterStudent[];
}> {
  const m = await requireCurrentMembership();
  const supabase = await createServerClient();
  const canEdit = m.role === "master" || m.role === "editor";

  const { data: classRows } = await supabase
    .from("classes")
    .select("id, grade, name, display_order")
    .eq("group_id", m.groupId)
    .order("grade", { ascending: true })
    .order("display_order", { ascending: true });

  let q = supabase
    .from("students")
    .select("id, name, grade, class_id, phone_self, phone_guardian, guardian_relation, deleted_at")
    .eq("group_id", m.groupId)
    .order("grade", { ascending: true })
    .order("name", { ascending: true });
  q = opts?.includeDeleted ? q.not("deleted_at", "is", null) : q.is("deleted_at", null);
  const { data: studentRows } = await q;

  const students: RosterStudent[] = (studentRows ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    grade: s.grade,
    classId: s.class_id,
    phoneSelf: s.phone_self,
    phoneGuardian: s.phone_guardian,
    guardianRelation: s.guardian_relation,
  }));

  return {
    canEdit,
    classes: (classRows ?? []).map((c) => ({
      id: c.id,
      grade: c.grade,
      name: c.name,
      displayOrder: c.display_order,
    })),
    students,
  };
}
```

> Slice 4가 이 파일에 `maskPhone` 을 추가하고, `phoneSelf`/`phoneGuardian` 매핑을 `m.role === "viewer" ? maskPhone(...) : ...` 로 감싼다.

- [ ] **Step 7: 공용 학생 폼 구현**

Create `components/student-form.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createStudent, updateStudent } from "@/app/actions/students";
import type { RosterClass } from "@/lib/students";

type Initial = {
  name: string;
  grade: number;
  classId: string | null;
  birthdayMonth: number | null;
  birthdayDay: number | null;
  birthdayYear: number | null;
  phoneSelf: string | null;
  phoneGuardian: string | null;
  guardianRelation: string | null;
};

export function StudentForm({
  classes,
  initial,
  studentId,
}: {
  classes: RosterClass[];
  initial?: Initial;
  studentId?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(undefined);
    const payload = {
      name: String(formData.get("name") ?? ""),
      grade: Number(formData.get("grade") ?? 1),
      classId: (formData.get("classId") as string) || null,
      birthdayMonth: formData.get("birthdayMonth") ? Number(formData.get("birthdayMonth")) : null,
      birthdayDay: formData.get("birthdayDay") ? Number(formData.get("birthdayDay")) : null,
      birthdayYear: formData.get("birthdayYear") ? Number(formData.get("birthdayYear")) : null,
      phoneSelf: (formData.get("phoneSelf") as string) || null,
      phoneGuardian: (formData.get("phoneGuardian") as string) || null,
      guardianRelation: (formData.get("guardianRelation") as string) || null,
    };
    startTransition(async () => {
      const result = studentId
        ? await updateStudent({ id: studentId, ...payload })
        : await createStudent(payload);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.push("/settings/roster");
    });
  }

  const input = "mt-1 w-full rounded-md border px-3 py-2";
  return (
    <form action={onSubmit} className="space-y-4">
      <label className="block">
        <span className="text-sm">이름 *</span>
        <input name="name" required defaultValue={initial?.name} className={input} />
      </label>
      <label className="block">
        <span className="text-sm">학년 *</span>
        <input name="grade" type="number" min={1} max={6} required defaultValue={initial?.grade ?? 1} className={input} />
      </label>
      <label className="block">
        <span className="text-sm">반</span>
        <select name="classId" defaultValue={initial?.classId ?? ""} className={input}>
          <option value="">반 없음</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.grade}학년 {c.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-2">
        <label className="block flex-1">
          <span className="text-sm">생일 월</span>
          <input name="birthdayMonth" type="number" min={1} max={12} defaultValue={initial?.birthdayMonth ?? ""} className={input} />
        </label>
        <label className="block flex-1">
          <span className="text-sm">일</span>
          <input name="birthdayDay" type="number" min={1} max={31} defaultValue={initial?.birthdayDay ?? ""} className={input} />
        </label>
        <label className="block flex-1">
          <span className="text-sm">연(선택)</span>
          <input name="birthdayYear" type="number" defaultValue={initial?.birthdayYear ?? ""} className={input} />
        </label>
      </div>
      <label className="block">
        <span className="text-sm">본인 연락처</span>
        <input name="phoneSelf" defaultValue={initial?.phoneSelf ?? ""} className={input} />
      </label>
      <label className="block">
        <span className="text-sm">보호자 연락처</span>
        <input name="phoneGuardian" defaultValue={initial?.phoneGuardian ?? ""} className={input} />
      </label>
      <label className="block">
        <span className="text-sm">보호자 관계</span>
        <select name="guardianRelation" defaultValue={initial?.guardianRelation ?? ""} className={input}>
          <option value="">선택 안 함</option>
          <option value="모">모</option>
          <option value="부">부</option>
          <option value="기타">기타</option>
        </select>
      </label>
      {error && <p className="text-sm text-coral-500">{error}</p>}
      <button type="submit" disabled={isPending} className="w-full rounded-lg bg-pasture-500 py-3 text-white disabled:opacity-50">
        {isPending ? "저장 중..." : "저장"}
      </button>
    </form>
  );
}
```

> **주의:** 이 폼은 `updateStudent` 를 import 한다. Slice 1 시점에 `app/actions/students.ts` 에 `updateStudent` 가 아직 없으면 typecheck 실패한다. 따라서 **Step 5에서 `updateStudent` 스텁을 함께 넣어라** — Slice 2가 본 구현으로 교체한다:
> ```ts
> export async function updateStudent(
>   input: { id: string } & StudentInput,
> ): Promise<{ error?: string }> {
>   // Slice 2에서 구현. Slice 1에서는 폼 타입만 만족시키는 스텁.
>   void input;
>   return { error: "아직 지원되지 않습니다" };
> }
> ```

- [ ] **Step 8: 목록 페이지 (반 그룹핑 로직 포함 — 반 없으면 학년별)**

Create `app/(app)/settings/roster/page.tsx`:

```tsx
import Link from "next/link";
import { loadRoster } from "@/lib/students";

export default async function RosterPage() {
  const { canEdit, classes, students } = await loadRoster();
  const classMap = new Map(classes.map((c) => [c.id, c]));

  const groups = new Map<string, { label: string; sort: number; items: typeof students }>();
  for (const s of students) {
    const cls = s.classId ? classMap.get(s.classId) : null;
    const key = cls ? `c:${cls.id}` : `g:${s.grade}`;
    const label = cls ? `${cls.grade}학년 ${cls.name}` : `${s.grade}학년 (반 없음)`;
    const sort = cls ? cls.grade * 1000 + cls.displayOrder : s.grade * 1000 + 999;
    if (!groups.has(key)) groups.set(key, { label, sort, items: [] });
    groups.get(key)!.items.push(s);
  }
  const sections = [...groups.values()].sort((a, b) => a.sort - b.sort);

  return (
    <main className="mx-auto max-w-2xl px-6 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">학적부</h1>
        {canEdit && (
          <Link href="/settings/roster/new" className="rounded-md bg-pasture-500 px-4 py-2 text-sm text-white">
            + 학생 추가
          </Link>
        )}
      </div>

      <div className="mt-3 flex gap-3 text-sm">
        {canEdit && (
          <Link href="/settings/roster/classes" className="text-pasture-600 underline">반 관리</Link>
        )}
        <Link href="/settings/roster/hidden" className="text-gray-500 underline">숨김 학생</Link>
      </div>

      {sections.length === 0 ? (
        <p className="mt-10 text-center text-gray-500">아직 등록된 학생이 없어요 🐑</p>
      ) : (
        sections.map((sec) => (
          <section key={sec.label} className="mt-8">
            <h2 className="text-lg font-semibold">{sec.label} ({sec.items.length})</h2>
            <ul className="mt-3 space-y-2">
              {sec.items.map((s) => (
                <li key={s.id}>
                  <Link href={`/settings/roster/${s.id}`} className="block rounded-lg border bg-white p-3 shadow-sm hover:bg-pasture-50">
                    <span className="font-medium">{s.name}</span>
                    {s.phoneSelf && <span className="ml-2 text-xs text-gray-500">{s.phoneSelf}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
```

> 목록 항목은 `/settings/roster/${s.id}` 로 링크한다. 이 상세 페이지는 Slice 2에서 생성 — Slice 1 시점엔 클릭 시 404지만, 추가/목록 확인에는 지장 없음(Step 11 데모는 목록 표시까지).

- [ ] **Step 9: 추가 페이지**

Create `app/(app)/settings/roster/new/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { loadRoster } from "@/lib/students";
import { StudentForm } from "@/components/student-form";

export default async function NewStudentPage() {
  const { canEdit, classes } = await loadRoster();
  if (!canEdit) redirect("/settings/roster");
  return (
    <main className="mx-auto max-w-2xl px-6 py-6">
      <h1 className="text-2xl font-bold">학생 추가</h1>
      <div className="mt-6">
        <StudentForm classes={classes} />
      </div>
    </main>
  );
}
```

- [ ] **Step 10: 설정에 학적부 링크 추가**

Modify `app/(app)/settings/page.tsx` — `<nav className="mt-8 space-y-2">` 바로 다음 줄(마스터 조건 블록 위)에 삽입:

```tsx
        <Link
          href="/settings/roster"
          className="block rounded-lg bg-white p-4 shadow-sm hover:bg-pasture-50"
        >
          📖 학적부 (학생 명단)
        </Link>
```

- [ ] **Step 11: 검증 (typecheck + build) + 동작 확인**

포트 3100 비어있는지 확인 후:
Run: `npm run typecheck && npm run build`
Expected: 클린 + `/settings/roster`, `/settings/roster/new` 라우트 등장.

**동작 확인(사용자):** `npm run dev` → 로그인 → 설정 → 학적부 → 학생 추가 → 목록에 뜸. ✅ (이 지점에서 Sarah가 실제로 확인)

- [ ] **Step 12: 커밋**

```bash
git add lib/validation/student.ts lib/students.ts app/actions/students.ts components/student-form.tsx "app/(app)/settings/roster/page.tsx" "app/(app)/settings/roster/new/page.tsx" "app/(app)/settings/page.tsx" tests/unit/student-schema.test.ts
git commit -m "Slice 1: add + list students end-to-end (Plan 2)"
```

---

## Slice 2: 수정 · 삭제(숨김) · 복원

목표: 학생 상세 페이지에서 수정/삭제, 숨김 탭에서 복원. Slice 1의 `updateStudent` 스텁을 실제 구현으로 교체.

**Files:**
- Modify: `app/actions/students.ts` (updateStudent 실구현 + softDeleteStudent + restoreStudent)
- Create: `app/(app)/settings/roster/[studentId]/page.tsx`, `app/(app)/settings/roster/hidden/page.tsx`, `tests/integration/roster-soft-delete.test.ts`

**Interfaces:**
- Consumes: `toRow`/`requireEditor` (students.ts 내부), `loadRoster({includeDeleted})`, `StudentForm`.
- Produces: `updateStudent(...)`(실구현), `softDeleteStudent(input:{id:string})`, `restoreStudent(input:{id:string})`.

- [ ] **Step 1: 소프트삭제 통합 테스트 (실패 예정)**

Create `tests/integration/roster-soft-delete.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, cleanup, createTestUser } from "./setup";

describe("soft delete excludes from active list", () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  it("editor soft-deletes; row leaves active filter but restore brings it back", async () => {
    const admin = adminClient();
    const master = await createTestUser();
    const editor = await createTestUser();
    const { data: group } = await admin
      .from("groups")
      .insert({ name: "R", join_code: "SDEL0001", created_by: master.userId })
      .select("id")
      .single();
    await admin.from("memberships").insert([
      { group_id: group!.id, user_id: master.userId, role: "master", status: "active" },
      { group_id: group!.id, user_id: editor.userId, role: "editor", status: "active" },
    ]);
    const asEditor = anonClient(editor.accessToken);
    const { data: s } = await asEditor
      .from("students")
      .insert({ group_id: group!.id, name: "지울학생", grade: 3 })
      .select("id")
      .single();

    await asEditor.from("students").update({ deleted_at: new Date().toISOString() }).eq("id", s!.id);
    const active = await asEditor.from("students").select("id").is("deleted_at", null);
    expect(active.data?.find((r) => r.id === s!.id)).toBeUndefined();

    await asEditor.from("students").update({ deleted_at: null }).eq("id", s!.id);
    const activeAgain = await asEditor.from("students").select("id").is("deleted_at", null);
    expect(activeAgain.data?.find((r) => r.id === s!.id)).toBeTruthy();
  });
});
```

- [ ] **Step 2: 실행 → 확인**

Run (dangerouslyDisableSandbox): `npx vitest run tests/integration/roster-soft-delete.test.ts`
Expected: PASS(테이블은 Task 1에 존재) — 이 테스트는 소프트삭제 필터 계약의 회귀 방지용.

- [ ] **Step 3: students.ts에 update/delete/restore 구현**

Modify `app/actions/students.ts` — Slice 1의 `updateStudent` 스텁을 아래로 **교체**하고, 그 아래 두 함수를 추가:

```ts
export async function updateStudent(
  input: { id: string } & StudentInput,
): Promise<{ error?: string }> {
  const parsed = studentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  if (!input.id) return { error: "잘못된 요청" };
  const m = await requireEditor();
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("students")
    .update({ ...toRow(parsed.data), updated_at: new Date().toISOString() })
    .eq("id", input.id)
    .eq("group_id", m.groupId);
  if (error) return { error: error.message };
  revalidatePath("/settings/roster");
  revalidatePath(`/settings/roster/${input.id}`);
  return {};
}

export async function softDeleteStudent(input: { id: string }): Promise<{ error?: string }> {
  const m = await requireEditor();
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("students")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", input.id)
    .eq("group_id", m.groupId)
    .is("deleted_at", null);
  if (error) return { error: error.message };
  revalidatePath("/settings/roster");
  revalidatePath("/settings/roster/hidden");
  return {};
}

export async function restoreStudent(input: { id: string }): Promise<{ error?: string }> {
  const m = await requireEditor();
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("students")
    .update({ deleted_at: null })
    .eq("id", input.id)
    .eq("group_id", m.groupId);
  if (error) return { error: error.message };
  revalidatePath("/settings/roster");
  revalidatePath("/settings/roster/hidden");
  return {};
}
```

- [ ] **Step 4: 수정/삭제 페이지**

Create `app/(app)/settings/roster/[studentId]/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership } from "@/lib/memberships";
import { loadRoster } from "@/lib/students";
import { StudentForm } from "@/components/student-form";
import { softDeleteStudent } from "@/app/actions/students";

export default async function EditStudentPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const m = await requireCurrentMembership();
  if (m.role !== "master" && m.role !== "editor") redirect("/settings/roster");

  const supabase = await createServerClient();
  const { data: s } = await supabase
    .from("students")
    .select("id, name, grade, class_id, birthday_month, birthday_day, birthday_year, phone_self, phone_guardian, guardian_relation")
    .eq("id", studentId)
    .eq("group_id", m.groupId)
    .maybeSingle();
  if (!s) redirect("/settings/roster");

  const { classes } = await loadRoster();

  return (
    <main className="mx-auto max-w-2xl px-6 py-6">
      <h1 className="text-2xl font-bold">학생 수정</h1>
      <div className="mt-6">
        <StudentForm
          classes={classes}
          studentId={s.id}
          initial={{
            name: s.name,
            grade: s.grade,
            classId: s.class_id,
            birthdayMonth: s.birthday_month,
            birthdayDay: s.birthday_day,
            birthdayYear: s.birthday_year,
            phoneSelf: s.phone_self,
            phoneGuardian: s.phone_guardian,
            guardianRelation: s.guardian_relation,
          }}
        />
      </div>

      <form
        action={async () => {
          "use server";
          await softDeleteStudent({ id: studentId });
          redirect("/settings/roster");
        }}
        className="mt-8"
      >
        <button className="w-full rounded-lg border border-coral-500 py-3 text-coral-500">
          학생 삭제 (숨김 처리)
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 5: 숨김 학생 페이지**

Create `app/(app)/settings/roster/hidden/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { loadRoster } from "@/lib/students";
import { restoreStudent } from "@/app/actions/students";

export default async function HiddenStudentsPage() {
  const { canEdit, students } = await loadRoster({ includeDeleted: true });
  if (!canEdit) redirect("/settings/roster");

  return (
    <main className="mx-auto max-w-2xl px-6 py-6">
      <h1 className="text-2xl font-bold">숨김 학생</h1>
      <p className="mt-1 text-sm text-gray-500">삭제된 학생입니다. 복원할 수 있어요.</p>
      {students.length === 0 ? (
        <p className="mt-10 text-center text-gray-500">숨긴 학생이 없어요.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {students.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded-lg border bg-white p-3 shadow-sm">
              <span>{s.name} <span className="text-xs text-gray-500">{s.grade}학년</span></span>
              <form action={async () => { "use server"; await restoreStudent({ id: s.id }); }}>
                <button className="rounded-md border border-pasture-500 px-3 py-1 text-sm text-pasture-600">복원</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 6: 검증**

Run (dangerouslyDisableSandbox): `npx vitest run tests/integration/roster-soft-delete.test.ts && npm run typecheck && npm run build`
Expected: PASS + 클린 + 빌드 성공.

**동작 확인:** 학생 클릭 → 수정 저장 반영, 삭제 → 목록에서 사라지고 숨김 탭에 나타남 → 복원 → 목록 복귀.

- [ ] **Step 7: 커밋**

```bash
git add app/actions/students.ts "app/(app)/settings/roster/[studentId]/page.tsx" "app/(app)/settings/roster/hidden/page.tsx" tests/integration/roster-soft-delete.test.ts
git commit -m "Slice 2: edit, soft-delete, restore students (Plan 2)"
```

---

## Slice 3: 반 만들기 · 관리

목표: 반을 생성/삭제한다. 폼의 반 드롭다운과 목록의 반 그룹핑은 Slice 1에서 이미 준비됐으므로 **여기서는 반 CRUD만 추가**하면 자동으로 연결된다.

**Files:**
- Modify: `lib/validation/student.ts` (classSchema 추가)
- Create: `app/actions/classes.ts`, `app/(app)/settings/roster/classes/page.tsx`

**Interfaces:**
- Consumes: `requireCurrentMembership`, `loadRoster`.
- Produces:
  - `classSchema` + `type ClassInput = { grade: number; name: string }`
  - `createClass(input:{grade:number;name:string}): Promise<{error?:string;id?:string}>`
  - `renameClass(input:{id:string;name:string}): Promise<{error?:string}>`
  - `reorderClasses(input:{orderedIds:string[]}): Promise<{error?:string}>`
  - `deleteClass(input:{id:string}): Promise<{error?:string}>` (활성 학생 있으면 거부)

- [ ] **Step 1: classSchema 추가**

Modify `lib/validation/student.ts` — 파일 끝에 추가:

```ts
export const classSchema = z.object({
  grade: z.coerce.number().int().min(1).max(6),
  name: z.string().trim().min(1, "반 이름을 입력해주세요").max(30),
});

export type ClassInput = z.infer<typeof classSchema>;
```

- [ ] **Step 2: 반 액션 구현**

Create `app/actions/classes.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership, type CurrentMembership } from "@/lib/memberships";
import { classSchema } from "@/lib/validation/student";

async function requireEditor(): Promise<CurrentMembership> {
  const m = await requireCurrentMembership();
  if (m.role !== "master" && m.role !== "editor") throw new Error("편집 권한이 필요합니다");
  return m;
}

export async function createClass(input: { grade: number; name: string }): Promise<{ error?: string; id?: string }> {
  const parsed = classSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const m = await requireEditor();
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("classes")
    .insert({ group_id: m.groupId, grade: parsed.data.grade, name: parsed.data.name })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "같은 학년에 같은 이름의 반이 있습니다" };
    return { error: error.message };
  }
  revalidatePath("/settings/roster/classes");
  revalidatePath("/settings/roster");
  return { id: data.id };
}

export async function renameClass(input: { id: string; name: string }): Promise<{ error?: string }> {
  const name = input.name?.trim();
  if (!name) return { error: "반 이름을 입력해주세요" };
  const m = await requireEditor();
  const supabase = await createServerClient();
  const { error } = await supabase.from("classes").update({ name }).eq("id", input.id).eq("group_id", m.groupId);
  if (error) return { error: error.message };
  revalidatePath("/settings/roster/classes");
  return {};
}

export async function reorderClasses(input: { orderedIds: string[] }): Promise<{ error?: string }> {
  const m = await requireEditor();
  const supabase = await createServerClient();
  for (let i = 0; i < input.orderedIds.length; i++) {
    const { error } = await supabase
      .from("classes")
      .update({ display_order: i })
      .eq("id", input.orderedIds[i])
      .eq("group_id", m.groupId);
    if (error) return { error: error.message };
  }
  revalidatePath("/settings/roster/classes");
  return {};
}

export async function deleteClass(input: { id: string }): Promise<{ error?: string }> {
  const m = await requireEditor();
  const supabase = await createServerClient();
  const { count } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("group_id", m.groupId)
    .eq("class_id", input.id)
    .is("deleted_at", null);
  if ((count ?? 0) > 0) return { error: "이 반에 학생이 있어 삭제할 수 없습니다. 학생을 먼저 이동하세요." };
  const { error } = await supabase.from("classes").delete().eq("id", input.id).eq("group_id", m.groupId);
  if (error) return { error: error.message };
  revalidatePath("/settings/roster/classes");
  return {};
}
```

> `renameClass`·`reorderClasses` 는 액션만 제공하고 이 슬라이스의 관리 화면 UI에는 넣지 않는다(생성/삭제만). 이름변경·순서변경 UI가 필요하면 후속 작업으로 추가.

- [ ] **Step 3: 반 관리 페이지**

Create `app/(app)/settings/roster/classes/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { loadRoster } from "@/lib/students";
import { createClass, deleteClass } from "@/app/actions/classes";

export default async function ClassesPage() {
  const { canEdit, classes, students } = await loadRoster();
  if (!canEdit) redirect("/settings/roster");

  const countByClass = new Map<string, number>();
  for (const s of students) {
    if (s.classId) countByClass.set(s.classId, (countByClass.get(s.classId) ?? 0) + 1);
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-6">
      <h1 className="text-2xl font-bold">반 관리</h1>

      <form
        action={async (formData: FormData) => {
          "use server";
          await createClass({ grade: Number(formData.get("grade") ?? 1), name: String(formData.get("name") ?? "") });
        }}
        className="mt-6 flex gap-2"
      >
        <input name="grade" type="number" min={1} max={6} defaultValue={1} required className="w-20 rounded-md border px-3 py-2" aria-label="학년" />
        <input name="name" placeholder="반 이름 (예: 믿음반)" required className="flex-1 rounded-md border px-3 py-2" aria-label="반 이름" />
        <button className="rounded-md bg-pasture-500 px-4 py-2 text-white">추가</button>
      </form>

      <ul className="mt-8 space-y-2">
        {classes.length === 0 && (
          <p className="text-center text-gray-500">아직 반이 없어요. (반 없이도 사용 가능)</p>
        )}
        {classes.map((c) => {
          const n = countByClass.get(c.id) ?? 0;
          return (
            <li key={c.id} className="flex items-center justify-between rounded-lg border bg-white p-3 shadow-sm">
              <span>{c.grade}학년 {c.name} <span className="text-xs text-gray-500">({n}명)</span></span>
              {n === 0 && (
                <form action={async () => { "use server"; await deleteClass({ id: c.id }); }}>
                  <button className="rounded-md border border-coral-500 px-3 py-1 text-xs text-coral-500">삭제</button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
```

- [ ] **Step 4: 검증**

Run (dev 서버 꺼진 상태): `npm run typecheck && npm run build`
Expected: 클린 + 빌드 성공.

**동작 확인:** 반 관리에서 반 생성 → 학생 추가 폼의 드롭다운에 반 등장 → 배정한 학생이 목록에서 반별로 묶임. 학생 있는 반은 삭제 버튼 안 보이고, 빈 반만 삭제 가능.

- [ ] **Step 5: 커밋**

```bash
git add lib/validation/student.ts app/actions/classes.ts "app/(app)/settings/roster/classes/page.tsx"
git commit -m "Slice 3: class create/manage (Plan 2)"
```

---

## Slice 4: 조회 교사 연락처 마스킹

목표: viewer 역할에게만 연락처를 `010-****-5678` 로 가린다. `loadRoster` 한 곳만 수정.

**Files:**
- Modify: `lib/students.ts` (maskPhone 추가 + viewer 분기)
- Create: `tests/unit/mask-phone.test.ts`

**Interfaces:**
- Produces: `maskPhone(phone: string | null): string | null`

- [ ] **Step 1: 마스킹 단위 테스트 (실패 예정)**

Create `tests/unit/mask-phone.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { maskPhone } from "@/lib/students";

describe("maskPhone", () => {
  it("masks the middle block of a hyphenated mobile number", () => {
    expect(maskPhone("010-1234-5678")).toBe("010-****-5678");
  });
  it("masks a number without hyphens", () => {
    expect(maskPhone("01012345678")).toBe("010****5678");
  });
  it("returns null unchanged", () => {
    expect(maskPhone(null)).toBeNull();
  });
  it("keeps only the first 3 chars visible for odd formats", () => {
    expect(maskPhone("02-345")).toBe("02-***");
  });
});
```

- [ ] **Step 2: 실행 → 실패 확인**

Run: `npx vitest run tests/unit/mask-phone.test.ts`
Expected: FAIL — `maskPhone` export 없음.

- [ ] **Step 3: maskPhone 구현 + loadRoster 적용**

Modify `lib/students.ts`:

(a) 파일 상단(import 아래)에 함수 추가:

```ts
export function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  const parts = phone.split("-");
  if (parts.length === 3) {
    return `${parts[0]}-${"*".repeat(parts[1].length)}-${parts[2]}`;
  }
  if (/^\d{10,11}$/.test(phone)) {
    return `${phone.slice(0, 3)}${"*".repeat(phone.length - 7)}${phone.slice(-4)}`;
  }
  return phone
    .split("")
    .map((ch, i) => (i < 3 || ch === "-" ? ch : "*"))
    .join("");
}
```

(b) `loadRoster` 안에서 `const mask = m.role === "viewer";` 를 선언하고, students 매핑의 두 줄을 아래처럼 교체:

```ts
  const mask = m.role === "viewer";
  const students: RosterStudent[] = (studentRows ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    grade: s.grade,
    classId: s.class_id,
    phoneSelf: mask ? maskPhone(s.phone_self) : s.phone_self,
    phoneGuardian: mask ? maskPhone(s.phone_guardian) : s.phone_guardian,
    guardianRelation: s.guardian_relation,
  }));
```

- [ ] **Step 4: 실행 → 통과**

Run: `npx vitest run tests/unit/mask-phone.test.ts && npm run typecheck`
Expected: PASS + 클린.

> 참고: `"02-345"` → 3블록 아님, 10~11자리 숫자 아님 → 3번째 규칙으로 `"02-***"`.

- [ ] **Step 5: 커밋**

```bash
git add lib/students.ts tests/unit/mask-phone.test.ts
git commit -m "Slice 4: mask contacts for viewer role (Plan 2)"
```

---

## 최종 검증 (Plan 2 완료)

- [ ] **전체 shipping bar (Plan 1 기준과 동일)**

포트 3100 비어있는지 확인(있으면 `Stop-Process -Force`) 후 순차 실행(모두 dangerouslyDisableSandbox):
```bash
rm -rf .next
npm run typecheck
npm test
npx playwright test
npm run build
```
Expected: typecheck 클린 · vitest 전부 PASS(기존 11 + 신규 단위 2 + 통합 2) · Playwright 5/5(기존 골든패스 회귀 없음) · build 성공.

- [ ] **동작 확인(사용자, 선택):** master로 반 생성→학생 추가→수정→삭제→복원. viewer 계정으로 로그인해 연락처가 마스킹되는지 확인.

---

## Self-Review (writing-plans)

**1. Spec coverage:**
- classes/students + RLS → Task 1 ✅
- studentSchema/검증 → Slice 1 ✅ · classSchema → Slice 3 ✅
- 학생 추가·목록 → Slice 1 ✅ · 수정·소프트삭제·복원 → Slice 2 ✅
- 반 생성·삭제(빈 반만) → Slice 3 ✅ (rename/reorder 액션 제공, UI는 후속)
- 반 없는 그룹 지원(class_id nullable + "반 없음") → Task 1 + Slice 1 ✅
- viewer 마스킹 → Slice 4 ✅
- 숨김 학생 복원 → Slice 2 ✅
- 설정 진입점 → Slice 1 Step 10 ✅
- 테스트(단위 2 + RLS/소프트삭제 통합 2) → Task 1·Slice 1·2·4 ✅
- 제외(엑셀/출석/진급/하드삭제 cron) → 계획에 없음(의도적) ✅

**2. Placeholder scan:** TBD/TODO 없음. `updateStudent` 는 Slice 1에서 **명시적 스텁**(폼 타입 충족용)으로 넣고 Slice 2에서 실구현으로 교체 — 각 스텝에 실제 코드 포함. ✅

**3. Type consistency:**
- `StudentInput`(카멜) ↔ DB row(스네이크)는 `toRow()`로 일관 매핑. `RosterStudent`(loadRoster 반환)와 `StudentForm`의 payload/`Initial` 필드명 일치. `requireEditor`는 students.ts·classes.ts 각자 정의(공유 의존 없음, 의도적). `maskPhone` 시그니처(Slice 4)와 loadRoster 사용부 일치. Slice 1 `student-form.tsx` 가 `updateStudent` 를 import 하므로 Slice 1 스텁이 반드시 선존재(주의 박스로 명시). ✅

**주의(구현 순서):** vertical slice라 뒤 슬라이스가 앞 파일을 확장한다. 반드시 **Task 1 → Slice 1 → 2 → 3 → 4** 순서로 실행. Slice 1의 `updateStudent` 스텁을 빼먹으면 `student-form.tsx` typecheck가 깨진다.
