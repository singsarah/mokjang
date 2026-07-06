# Plan 2 — 학적부 (학생 명단) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 교사가 학생 명단을 손으로 관리(추가·수정·소프트 삭제·복원)하고 반을 관리하는 기능을 만든다. 조회 교사에게는 연락처를 마스킹한다.

**Architecture:** Plan 1의 패턴을 그대로 답습한다 — Supabase 마이그레이션으로 `classes`/`students` 테이블 + RLS, `lib/supabase/database.types.ts` 수동 갱신, Zod 검증, `app/actions/*`의 서버 액션(쿠키 유저 클라이언트 + `requireCurrentMembership` 권한 확인 + `revalidatePath`), `app/(app)/settings/roster/*` 서버 컴포넌트 페이지 + 클라이언트 폼. 순수 로직(스키마·마스킹)은 Vitest 단위 테스트, RLS/액션은 dev DB 대상 Vitest 통합 테스트, 페이지는 typecheck+build로 검증.

**Tech Stack:** Next.js 15 (App Router, RSC + server actions), Supabase (Postgres + RLS), Zod v4, Vitest, TypeScript.

**설계 문서:** `docs/superpowers/specs/2026-07-06-plan-2-student-roster-design.md`

## Global Constraints

- 패키지 매니저 **npm 고정**. 개발 포트 **3100**. UI 텍스트 **한국어**.
- Supabase에 닿는 명령(`npm test`, `supabase db push`, curl)은 **`dangerouslyDisableSandbox: true`** 로 실행.
- 마이그레이션 push: `printf 'y\n' | npx supabase db push` (Docker/edge-runtime 경고는 무해).
- 새 마이그레이션 번호는 반드시 `npx supabase migration list --linked` 로 마지막 번호 확인 후 부여 (이 계획은 `20260706000001` 을 가정하되, 이미 존재하면 다음 free 번호).
- `supabase gen types` 는 이 머신에서 실패 → `lib/supabase/database.types.ts` **수동 갱신**.
- 서버 액션은 요청의 `group_id` 를 신뢰하지 않고 **항상 현재 멤버십의 `groupId`** 로 강제한다.
- 쓰기 권한은 **master·editor** 만. viewer는 read-only.
- **`npm run build` 는 dev 서버가 떠 있을 때 실행 금지** (dev `.next` 오염). build 전 포트 3100 확인.
- 커밋 메시지는 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` 로 끝낸다.

---

## File Structure

**생성:**
- `supabase/migrations/20260706000001_student_roster.sql` — classes/students 테이블 + 인덱스 + RLS
- `lib/validation/student.ts` — 학생/반 Zod 스키마 + 파생 타입
- `lib/students.ts` — `maskPhone`, `loadRoster` (그룹핑 + 역할별 마스킹)
- `app/actions/classes.ts` — 반 서버 액션
- `app/actions/students.ts` — 학생 서버 액션
- `app/(app)/settings/roster/page.tsx` — 학생 목록
- `app/(app)/settings/roster/new/page.tsx` — 학생 추가 폼
- `app/(app)/settings/roster/[studentId]/page.tsx` — 학생 수정/삭제
- `app/(app)/settings/roster/hidden/page.tsx` — 숨김 학생 + 복원
- `app/(app)/settings/roster/classes/page.tsx` — 반 관리
- `components/student-form.tsx` — 추가/수정 공용 클라이언트 폼
- `tests/unit/student-schema.test.ts`, `tests/unit/mask-phone.test.ts`
- `tests/integration/roster-rls.test.ts`, `tests/integration/roster-actions.test.ts`

**수정:**
- `lib/supabase/database.types.ts` — classes/students 추가
- `app/(app)/settings/page.tsx` — "학적부" 링크 추가

---

## Task 1: 마이그레이션 — classes/students 테이블 + RLS + 타입

**Files:**
- Create: `supabase/migrations/20260706000001_student_roster.sql`
- Create: `tests/integration/roster-rls.test.ts`
- Modify: `lib/supabase/database.types.ts`

**Interfaces:**
- Produces: `classes` 테이블(`id, group_id, grade, name, display_order, created_at`), `students` 테이블(`id, group_id, class_id, name, grade, birthday_month/day/year, phone_self, phone_guardian, guardian_relation, deleted_at, created_at, updated_at`). RLS: 활성 멤버 read, master·editor write. Plan 1 헬퍼 `is_active_member`/`user_role_in_group` 재사용.

- [ ] **Step 1: 다음 마이그레이션 번호 확인**

Run (dangerouslyDisableSandbox): `npx supabase migration list --linked`
Expected: 마지막이 `20260703000005`. 다음 번호로 `20260706000001` 사용 (이미 있으면 그 다음).

- [ ] **Step 2: RLS 통합 테스트 작성 (실패 예정)**

Create `tests/integration/roster-rls.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, cleanup, createTestUser } from "./setup";

// 그룹 + master/editor/viewer 멤버를 만들고 각 access token을 돌려준다.
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
    await asViewer
      .from("students")
      .insert({ group_id: group.id, name: "차단", grade: 1 });
    // RLS는 조용히 0행 삽입(또는 에러) → admin으로 확인해 "차단" 학생이 없어야 함
    const admin = adminClient();
    const { data: rows } = await admin
      .from("students")
      .select("name")
      .eq("group_id", group.id);
    expect(rows?.map((r) => r.name).sort()).toEqual(["홍길동"]);
  });

  it("viewer can read students; other group cannot", async () => {
    const a = await makeGroupWithRoles("ROST0002");
    const b = await makeGroupWithRoles("ROST0003");
    const admin = adminClient();
    await admin
      .from("students")
      .insert({ group_id: a.group.id, name: "A학생", grade: 2 });

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
Expected: FAIL — `relation "public.students" does not exist` (테이블 없음).

- [ ] **Step 4: 마이그레이션 SQL 작성**

Create `supabase/migrations/20260706000001_student_roster.sql`:

```sql
-- 반
CREATE TABLE classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  grade int NOT NULL,
  name text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, grade, name)
);

-- 학생
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

-- 읽기: 활성 멤버 전원(viewer 포함)
CREATE POLICY "members read classes" ON classes FOR SELECT
  USING (is_active_member(group_id, auth.uid()));
CREATE POLICY "members read students" ON students FOR SELECT
  USING (is_active_member(group_id, auth.uid()));

-- 쓰기: master·editor만
CREATE POLICY "editors write classes" ON classes FOR ALL
  USING (user_role_in_group(group_id, auth.uid()) IN ('master','editor'))
  WITH CHECK (user_role_in_group(group_id, auth.uid()) IN ('master','editor'));
CREATE POLICY "editors write students" ON students FOR ALL
  USING (user_role_in_group(group_id, auth.uid()) IN ('master','editor'))
  WITH CHECK (user_role_in_group(group_id, auth.uid()) IN ('master','editor'));
```

- [ ] **Step 5: 마이그레이션 push**

Run (dangerouslyDisableSandbox): `printf 'y\n' | npx supabase db push`
Expected: `Applying migration 20260706000001_student_roster.sql...` 후 성공 (edge-runtime 경고 무시).

- [ ] **Step 6: database.types.ts 수동 갱신**

Modify `lib/supabase/database.types.ts` — `public.Tables` 안, `audit_log` 앞(알파벳 순 상관없음)에 두 블록 추가:

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

- [ ] **Step 7: 테스트 재실행 → 통과 + 타입 확인**

Run (dangerouslyDisableSandbox): `npx vitest run tests/integration/roster-rls.test.ts && npm run typecheck`
Expected: 통합 테스트 PASS, typecheck 클린.

- [ ] **Step 8: 커밋**

```bash
git add supabase/migrations/20260706000001_student_roster.sql lib/supabase/database.types.ts tests/integration/roster-rls.test.ts
git commit -m "Add classes/students tables with RLS (Plan 2 Task 1)"
```

---

## Task 2: Zod 스키마 + 연락처 마스킹

**Files:**
- Create: `lib/validation/student.ts`
- Create: `lib/students.ts` (이번 태스크에서는 `maskPhone` 만)
- Create: `tests/unit/student-schema.test.ts`, `tests/unit/mask-phone.test.ts`

**Interfaces:**
- Produces:
  - `studentSchema` (Zod) + `type StudentInput = z.infer<typeof studentSchema>` — `{ name: string; grade: number; classId: string | null; birthdayMonth: number | null; birthdayDay: number | null; birthdayYear: number | null; phoneSelf: string | null; phoneGuardian: string | null; guardianRelation: "모"|"부"|"기타"|null }`
  - `classSchema` — `{ grade: number; name: string }`
  - `maskPhone(phone: string | null): string | null`

- [ ] **Step 1: 마스킹 단위 테스트 작성 (실패 예정)**

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

- [ ] **Step 2: 스키마 단위 테스트 작성 (실패 예정)**

Create `tests/unit/student-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { studentSchema } from "@/lib/validation/student";

describe("studentSchema", () => {
  it("accepts a minimal valid student", () => {
    const r = studentSchema.safeParse({ name: "김철수", grade: 1 });
    expect(r.success).toBe(true);
  });
  it("rejects empty name", () => {
    const r = studentSchema.safeParse({ name: "", grade: 1 });
    expect(r.success).toBe(false);
  });
  it("rejects birthday_month out of range", () => {
    const r = studentSchema.safeParse({ name: "A", grade: 1, birthdayMonth: 13 });
    expect(r.success).toBe(false);
  });
  it("coerces optional blanks to null", () => {
    const r = studentSchema.parse({ name: "A", grade: 2, phoneSelf: "" });
    expect(r.phoneSelf).toBeNull();
  });
  it("rejects invalid guardian relation", () => {
    const r = studentSchema.safeParse({ name: "A", grade: 1, guardianRelation: "삼촌" });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 3: 테스트 실행 → 실패 확인**

Run: `npx vitest run tests/unit/mask-phone.test.ts tests/unit/student-schema.test.ts`
Expected: FAIL — 모듈/함수 없음.

- [ ] **Step 4: 스키마 구현**

Create `lib/validation/student.ts`:

```ts
import { z } from "zod";

// 빈 문자열/undefined → null 로 정규화하는 헬퍼
const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullish()
  .transform((v) => v ?? null);

const optionalInt = (min: number, max: number) =>
  z.coerce
    .number()
    .int()
    .min(min)
    .max(max)
    .nullish()
    .transform((v) => v ?? null);

export const studentSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해주세요").max(50),
  grade: z.coerce.number().int().min(1, "학년을 선택해주세요").max(6),
  classId: z
    .string()
    .uuid()
    .nullish()
    .transform((v) => v ?? null),
  birthdayMonth: optionalInt(1, 12),
  birthdayDay: optionalInt(1, 31),
  birthdayYear: optionalInt(1900, 2100),
  phoneSelf: optionalText,
  phoneGuardian: optionalText,
  guardianRelation: z
    .enum(["모", "부", "기타"])
    .nullish()
    .transform((v) => v ?? null),
});

export type StudentInput = z.infer<typeof studentSchema>;

export const classSchema = z.object({
  grade: z.coerce.number().int().min(1).max(6),
  name: z.string().trim().min(1, "반 이름을 입력해주세요").max(30),
});

export type ClassInput = z.infer<typeof classSchema>;
```

- [ ] **Step 5: 마스킹 구현**

Create `lib/students.ts`:

```ts
// 전화번호 가운데를 가린다. viewer 역할에게만 적용.
export function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  // 하이픈 기준 3블록이면 가운데를 별표로.
  const parts = phone.split("-");
  if (parts.length === 3) {
    return `${parts[0]}-${"*".repeat(parts[1].length)}-${parts[2]}`;
  }
  // 하이픈 없는 11자리 휴대폰: 앞 3 + **** + 뒤 4
  if (/^\d{10,11}$/.test(phone)) {
    return `${phone.slice(0, 3)}${"*".repeat(phone.length - 7)}${phone.slice(-4)}`;
  }
  // 그 외: 앞 세 글자만 남기고 마스킹 (구분자는 유지)
  return phone
    .split("")
    .map((ch, i) => (i < 3 || ch === "-" ? ch : "*"))
    .join("");
}
```

- [ ] **Step 6: 테스트 실행 → 통과**

Run: `npx vitest run tests/unit/mask-phone.test.ts tests/unit/student-schema.test.ts && npm run typecheck`
Expected: 전부 PASS, typecheck 클린.

> 참고: `"02-345"` → 3블록 아님, 11자리 숫자 아님 → 3번째 규칙으로 `"02-***"` (앞 2자리 + 하이픈 유지 + 나머지 마스킹). `"01012345678"`(11자리) → `"010****5678"`.

- [ ] **Step 7: 커밋**

```bash
git add lib/validation/student.ts lib/students.ts tests/unit/mask-phone.test.ts tests/unit/student-schema.test.ts
git commit -m "Add student/class Zod schemas and phone masking (Plan 2 Task 2)"
```

---

## Task 3: 반 서버 액션

**Files:**
- Create: `app/actions/classes.ts`
- Create: `tests/integration/roster-actions.test.ts` (반 부분; 학생 부분은 Task 4에서 확장)

**Interfaces:**
- Consumes: `classSchema` (Task 2), `requireCurrentMembership` (Plan 1 `lib/memberships.ts`).
- Produces:
  - `createClass(input: { grade: number; name: string }): Promise<{ error?: string; id?: string }>`
  - `renameClass(input: { id: string; name: string }): Promise<{ error?: string }>`
  - `reorderClasses(input: { orderedIds: string[] }): Promise<{ error?: string }>`
  - `deleteClass(input: { id: string }): Promise<{ error?: string }>` — 소속 학생(활성)이 있으면 거부
  - `requireEditor(): Promise<CurrentMembership>` (이 파일 내부 헬퍼; Task 4도 동일 로직을 자기 파일에 별도 정의)

- [ ] **Step 1: 통합 테스트 작성 (실패 예정)**

이 테스트는 서버 액션을 직접 부르지 않고(액션은 쿠키 컨텍스트 필요), **액션이 사용할 RLS 경로가 유효한지**를 editor 토큰으로 검증한다. Create `tests/integration/roster-actions.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, cleanup, createTestUser } from "./setup";

async function groupWithEditor(code: string) {
  const admin = adminClient();
  const master = await createTestUser();
  const editor = await createTestUser();
  const { data: group } = await admin
    .from("groups")
    .insert({ name: "R", join_code: code, created_by: master.userId })
    .select("id")
    .single();
  await admin.from("memberships").insert([
    { group_id: group!.id, user_id: master.userId, role: "master", status: "active" },
    { group_id: group!.id, user_id: editor.userId, role: "editor", status: "active" },
  ]);
  return { group: group!, editor };
}

describe("roster actions data paths (editor RLS)", () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  it("editor creates a class then a student in it", async () => {
    const { group, editor } = await groupWithEditor("ACTN0001");
    const asEditor = anonClient(editor.accessToken);

    const { data: cls, error: cErr } = await asEditor
      .from("classes")
      .insert({ group_id: group.id, grade: 1, name: "믿음반" })
      .select("id")
      .single();
    expect(cErr).toBeNull();

    const { error: sErr } = await asEditor.from("students").insert({
      group_id: group.id,
      class_id: cls!.id,
      name: "학생1",
      grade: 1,
    });
    expect(sErr).toBeNull();
  });

  it("soft-deleting a student sets deleted_at (still an UPDATE editor can do)", async () => {
    const { group, editor } = await groupWithEditor("ACTN0002");
    const asEditor = anonClient(editor.accessToken);
    const { data: s } = await asEditor
      .from("students")
      .insert({ group_id: group.id, name: "지울학생", grade: 3 })
      .select("id")
      .single();

    const { error } = await asEditor
      .from("students")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", s!.id);
    expect(error).toBeNull();

    const admin = adminClient();
    const { data: after } = await admin
      .from("students")
      .select("deleted_at")
      .eq("id", s!.id)
      .single();
    expect(after?.deleted_at).not.toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run (dangerouslyDisableSandbox): `npx vitest run tests/integration/roster-actions.test.ts`
Expected: FAIL (Task 1 마이그레이션이 이미 적용됐다면 이 테스트는 사실 통과할 수도 있음 — 그럴 경우 이 태스크의 "실패→구현" 대상은 액션 코드 자체이므로 Step 3로 진행). 목적은 RLS 경로 회귀 방지.

- [ ] **Step 3: 반 액션 구현**

Create `app/actions/classes.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership, type CurrentMembership } from "@/lib/memberships";
import { classSchema } from "@/lib/validation/student";

async function requireEditor(): Promise<CurrentMembership> {
  const m = await requireCurrentMembership();
  if (m.role !== "master" && m.role !== "editor") {
    throw new Error("편집 권한이 필요합니다");
  }
  return m;
}

export async function createClass(input: {
  grade: number;
  name: string;
}): Promise<{ error?: string; id?: string }> {
  const parsed = classSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };

  const m = await requireEditor();
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("classes")
    .insert({
      group_id: m.groupId,
      grade: parsed.data.grade,
      name: parsed.data.name,
    })
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

export async function renameClass(input: {
  id: string;
  name: string;
}): Promise<{ error?: string }> {
  const name = input.name?.trim();
  if (!name) return { error: "반 이름을 입력해주세요" };

  const m = await requireEditor();
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("classes")
    .update({ name })
    .eq("id", input.id)
    .eq("group_id", m.groupId);
  if (error) return { error: error.message };
  revalidatePath("/settings/roster/classes");
  return {};
}

export async function reorderClasses(input: {
  orderedIds: string[];
}): Promise<{ error?: string }> {
  const m = await requireEditor();
  const supabase = await createServerClient();
  // display_order = 배열 인덱스
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

export async function deleteClass(input: {
  id: string;
}): Promise<{ error?: string }> {
  const m = await requireEditor();
  const supabase = await createServerClient();

  // 소속 활성 학생이 있으면 거부
  const { count } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("group_id", m.groupId)
    .eq("class_id", input.id)
    .is("deleted_at", null);
  if ((count ?? 0) > 0) {
    return { error: "이 반에 학생이 있어 삭제할 수 없습니다. 학생을 먼저 이동하세요." };
  }

  const { error } = await supabase
    .from("classes")
    .delete()
    .eq("id", input.id)
    .eq("group_id", m.groupId);
  if (error) return { error: error.message };
  revalidatePath("/settings/roster/classes");
  return {};
}
```

- [ ] **Step 4: 테스트 실행 + typecheck**

Run (dangerouslyDisableSandbox): `npx vitest run tests/integration/roster-actions.test.ts && npm run typecheck`
Expected: PASS + typecheck 클린.

- [ ] **Step 5: 커밋**

```bash
git add app/actions/classes.ts tests/integration/roster-actions.test.ts
git commit -m "Add class server actions (Plan 2 Task 3)"
```

---

## Task 4: 학생 서버 액션

**Files:**
- Create: `app/actions/students.ts`

**Interfaces:**
- Consumes: `studentSchema`/`StudentInput` (Task 2), `requireCurrentMembership`.
- Produces:
  - `createStudent(input: StudentInput): Promise<{ error?: string; id?: string }>`
  - `updateStudent(input: { id: string } & StudentInput): Promise<{ error?: string }>`
  - `softDeleteStudent(input: { id: string }): Promise<{ error?: string }>`
  - `restoreStudent(input: { id: string }): Promise<{ error?: string }>`

- [ ] **Step 1: 학생 액션 구현**

Create `app/actions/students.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership, type CurrentMembership } from "@/lib/memberships";
import { studentSchema, type StudentInput } from "@/lib/validation/student";

async function requireEditor(): Promise<CurrentMembership> {
  const m = await requireCurrentMembership();
  if (m.role !== "master" && m.role !== "editor") {
    throw new Error("편집 권한이 필요합니다");
  }
  return m;
}

// StudentInput(카멜) → DB 컬럼(스네이크) 매핑
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

export async function softDeleteStudent(input: {
  id: string;
}): Promise<{ error?: string }> {
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

export async function restoreStudent(input: {
  id: string;
}): Promise<{ error?: string }> {
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

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`
Expected: 클린.

- [ ] **Step 3: 커밋**

```bash
git add app/actions/students.ts
git commit -m "Add student server actions (Plan 2 Task 4)"
```

---

## Task 5: 로스터 로더 + 학생 목록 페이지

**Files:**
- Modify: `lib/students.ts` (add `loadRoster`)
- Create: `app/(app)/settings/roster/page.tsx`

**Interfaces:**
- Consumes: `maskPhone` (Task 2), `requireCurrentMembership`.
- Produces:
  - `type RosterStudent = { id: string; name: string; grade: number; classId: string | null; phoneSelf: string | null; phoneGuardian: string | null; guardianRelation: string | null }`
  - `type RosterClass = { id: string; grade: number; name: string; displayOrder: number }`
  - `loadRoster(opts?: { includeDeleted?: boolean }): Promise<{ canEdit: boolean; classes: RosterClass[]; students: RosterStudent[] }>` — 현재 멤버십 그룹의 반+학생을 읽고, viewer면 연락처 마스킹. `includeDeleted:true` 면 `deleted_at IS NOT NULL` 만(숨김 탭용), 아니면 활성만.

- [ ] **Step 1: loadRoster 구현**

Add to `lib/students.ts`:

```ts
import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership } from "@/lib/memberships";

export type RosterClass = {
  id: string;
  grade: number;
  name: string;
  displayOrder: number;
};
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
    .select(
      "id, name, grade, class_id, phone_self, phone_guardian, guardian_relation, deleted_at",
    )
    .eq("group_id", m.groupId)
    .order("grade", { ascending: true })
    .order("name", { ascending: true });
  q = opts?.includeDeleted
    ? q.not("deleted_at", "is", null)
    : q.is("deleted_at", null);
  const { data: studentRows } = await q;

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

- [ ] **Step 2: 목록 페이지 구현**

Create `app/(app)/settings/roster/page.tsx`:

```tsx
import Link from "next/link";
import { loadRoster } from "@/lib/students";

export default async function RosterPage() {
  const { canEdit, classes, students } = await loadRoster();
  const classMap = new Map(classes.map((c) => [c.id, c]));

  // 반별(반 없으면 학년별) 그룹핑. key = classId ?? `grade:${grade}`
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
          <Link
            href="/settings/roster/new"
            className="rounded-md bg-pasture-500 px-4 py-2 text-sm text-white"
          >
            + 학생 추가
          </Link>
        )}
      </div>

      <div className="mt-3 flex gap-3 text-sm">
        {canEdit && (
          <Link href="/settings/roster/classes" className="text-pasture-600 underline">
            반 관리
          </Link>
        )}
        <Link href="/settings/roster/hidden" className="text-gray-500 underline">
          숨김 학생
        </Link>
      </div>

      {sections.length === 0 ? (
        <p className="mt-10 text-center text-gray-500">
          아직 등록된 학생이 없어요 🐑
        </p>
      ) : (
        sections.map((sec) => (
          <section key={sec.label} className="mt-8">
            <h2 className="text-lg font-semibold">
              {sec.label} ({sec.items.length})
            </h2>
            <ul className="mt-3 space-y-2">
              {sec.items.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/settings/roster/${s.id}`}
                    className="block rounded-lg border bg-white p-3 shadow-sm hover:bg-pasture-50"
                  >
                    <span className="font-medium">{s.name}</span>
                    {s.phoneSelf && (
                      <span className="ml-2 text-xs text-gray-500">{s.phoneSelf}</span>
                    )}
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

- [ ] **Step 3: typecheck + build**

먼저 포트 3100이 비었는지 확인(dev 서버 꺼짐) 후:
Run: `npm run typecheck && npm run build`
Expected: 클린 + 빌드 성공(`/settings/roster` 라우트 등장).

- [ ] **Step 4: 커밋**

```bash
git add lib/students.ts "app/(app)/settings/roster/page.tsx"
git commit -m "Add roster loader and student list page (Plan 2 Task 5)"
```

---

## Task 6: 학생 추가/수정/삭제 폼 + 페이지

**Files:**
- Create: `components/student-form.tsx` (추가/수정 공용 클라이언트 폼)
- Create: `app/(app)/settings/roster/new/page.tsx`
- Create: `app/(app)/settings/roster/[studentId]/page.tsx`

**Interfaces:**
- Consumes: `createStudent`/`updateStudent`/`softDeleteStudent` (Task 4), `loadRoster`/`RosterClass` (Task 5), `requireCurrentMembership`.
- Produces: `StudentForm` 컴포넌트 — `{ classes: RosterClass[]; initial?: {...}; studentId?: string }` props.

- [ ] **Step 1: 공용 폼 컴포넌트 구현**

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
        <input
          name="grade"
          type="number"
          min={1}
          max={6}
          required
          defaultValue={initial?.grade ?? 1}
          className={input}
        />
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
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-pasture-500 py-3 text-white disabled:opacity-50"
      >
        {isPending ? "저장 중..." : "저장"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: 추가 페이지**

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

- [ ] **Step 3: 수정/삭제 페이지**

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
    .select(
      "id, name, grade, class_id, birthday_month, birthday_day, birthday_year, phone_self, phone_guardian, guardian_relation",
    )
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

- [ ] **Step 4: typecheck + build**

Run (dev 서버 꺼진 상태): `npm run typecheck && npm run build`
Expected: 클린 + `/settings/roster/new`, `/settings/roster/[studentId]` 라우트 등장.

- [ ] **Step 5: 커밋**

```bash
git add components/student-form.tsx "app/(app)/settings/roster/new/page.tsx" "app/(app)/settings/roster/[studentId]/page.tsx"
git commit -m "Add student add/edit/delete forms (Plan 2 Task 6)"
```

---

## Task 7: 숨김 학생 페이지 + 반 관리 페이지

**Files:**
- Create: `app/(app)/settings/roster/hidden/page.tsx`
- Create: `app/(app)/settings/roster/classes/page.tsx`

**Interfaces:**
- Consumes: `loadRoster` (`includeDeleted`), `restoreStudent` (Task 4), `createClass`/`renameClass`/`deleteClass` (Task 3), `requireCurrentMembership`.

- [ ] **Step 1: 숨김 학생 페이지**

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
            <li
              key={s.id}
              className="flex items-center justify-between rounded-lg border bg-white p-3 shadow-sm"
            >
              <span>
                {s.name} <span className="text-xs text-gray-500">{s.grade}학년</span>
              </span>
              <form
                action={async () => {
                  "use server";
                  await restoreStudent({ id: s.id });
                }}
              >
                <button className="rounded-md border border-pasture-500 px-3 py-1 text-sm text-pasture-600">
                  복원
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 2: 반 관리 페이지**

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
          await createClass({
            grade: Number(formData.get("grade") ?? 1),
            name: String(formData.get("name") ?? ""),
          });
        }}
        className="mt-6 flex gap-2"
      >
        <input
          name="grade"
          type="number"
          min={1}
          max={6}
          defaultValue={1}
          required
          className="w-20 rounded-md border px-3 py-2"
          aria-label="학년"
        />
        <input
          name="name"
          placeholder="반 이름 (예: 믿음반)"
          required
          className="flex-1 rounded-md border px-3 py-2"
          aria-label="반 이름"
        />
        <button className="rounded-md bg-pasture-500 px-4 py-2 text-white">추가</button>
      </form>

      <ul className="mt-8 space-y-2">
        {classes.length === 0 && (
          <p className="text-center text-gray-500">아직 반이 없어요. (반 없이도 사용 가능)</p>
        )}
        {classes.map((c) => {
          const n = countByClass.get(c.id) ?? 0;
          return (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-lg border bg-white p-3 shadow-sm"
            >
              <span>
                {c.grade}학년 {c.name}{" "}
                <span className="text-xs text-gray-500">({n}명)</span>
              </span>
              {n === 0 && (
                <form
                  action={async () => {
                    "use server";
                    await deleteClass({ id: c.id });
                  }}
                >
                  <button className="rounded-md border border-coral-500 px-3 py-1 text-xs text-coral-500">
                    삭제
                  </button>
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

- [ ] **Step 3: typecheck + build**

Run (dev 서버 꺼진 상태): `npm run typecheck && npm run build`
Expected: 클린 + 빌드 성공.

- [ ] **Step 4: 커밋**

```bash
git add "app/(app)/settings/roster/hidden/page.tsx" "app/(app)/settings/roster/classes/page.tsx"
git commit -m "Add hidden students and class management pages (Plan 2 Task 7)"
```

---

## Task 8: 설정 진입점 연결 + 전체 검증

**Files:**
- Modify: `app/(app)/settings/page.tsx`

**Interfaces:**
- Consumes: 전부.

- [ ] **Step 1: 설정에 학적부 링크 추가**

Modify `app/(app)/settings/page.tsx` — `<nav>` 안, 마스터 전용 블록 위(모든 활성 교사가 학적부 접근 가능하므로 조건 밖)에 링크 추가:

```tsx
      <nav className="mt-8 space-y-2">
        <Link
          href="/settings/roster"
          className="block rounded-lg bg-white p-4 shadow-sm hover:bg-pasture-50"
        >
          📖 학적부 (학생 명단)
        </Link>
        {m.role === "master" && (
          <>
```

(기존 `{m.role === "master" && (` 블록은 그대로 이어짐.)

- [ ] **Step 2: 전체 shipping bar (Plan 1 기준과 동일)**

먼저 포트 3100이 비었는지 확인:
`Get-NetTCPConnection -LocalPort 3100 -State Listen` → 있으면 `Stop-Process -Id <pid> -Force`.

그다음 순차 실행(모두 dangerouslyDisableSandbox):
```bash
rm -rf .next
npm run typecheck
npm test
npx playwright test
npm run build
```
Expected: typecheck 클린 · vitest 전부 PASS(기존 11 + 신규 통합/단위) · Playwright 5/5(기존 골든패스 회귀 없음) · build 성공.

- [ ] **Step 3: 커밋**

```bash
git add "app/(app)/settings/page.tsx"
git commit -m "Wire roster into settings; Plan 2 complete (Plan 2 Task 8)"
```

---

## Self-Review (writing-plans)

**1. Spec coverage:**
- classes/students 테이블 + RLS → Task 1 ✅
- Zod 검증 + 마스킹 → Task 2 ✅
- 반 CRUD(생성/이름변경/순서/삭제) → Task 3 (+ 반 관리 UI Task 7) ✅
- 학생 CRUD(추가/수정/소프트삭제/복원) → Task 4 (+ UI Task 5·6·7) ✅
- viewer 마스킹 → Task 2(함수)+Task 5(loadRoster 적용) ✅
- 숨김 학생 복원 → Task 7 ✅
- 반 없는 그룹 지원 → students.class_id nullable(Task 1) + 목록/폼 "반 없음"(Task 5·6) ✅
- 테스트(단위+RLS 통합) → Task 1·2·3 ✅
- 설정 진입점 → Task 8 ✅
- 제외(엑셀/출석/진급/하드삭제 cron) → 계획에 없음(의도적) ✅

**2. Placeholder scan:** TBD/TODO/"적절히 처리" 없음. 모든 코드 스텝에 실제 코드 포함. ✅

**3. Type consistency:**
- `StudentInput`(카멜) ↔ DB row(스네이크)는 `toRow()`로 일관 매핑(Task 4). `loadRoster`가 반환하는 `RosterStudent`(카멜)와 `StudentForm`의 `Initial`/payload 필드명 일치. `requireEditor`는 Task 3·4가 각자 파일에 동일 정의(공유 의존 없음, 의도적). `reorderClasses`는 계획에 액션만 있고 UI(드래그/순서변경)는 미포함 — 설계 §9에서 순서 UI는 "위/아래 버튼 권장"이나 MVP에서 생략 가능하므로 액션만 제공(후속 확장 여지). ✅

> 주의(구현자): `reorderClasses` 액션은 만들지만 Task 7 반 관리 UI는 순서변경 버튼을 넣지 않는다(생성/삭제만). 순서 변경 UI가 필요하면 후속 작업으로 추가.
