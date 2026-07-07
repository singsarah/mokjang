# Plan 4 — 반 수정 · 반 배정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 반 관리에서 기존 반의 이름·선생님을 수정하고, 학생을 명단에서 다중 선택해 반에 넣고/빼는 기능을 추가한다.

**Architecture:** 스키마 변경 없이 기존 컬럼(`students.class_id`, `classes.teacher_name`)만 사용. 백엔드는 서버 액션 2개(`updateClass`, `assignStudents`)로, UI는 새 **반 상세 페이지**(`settings/roster/classes/[classId]`) + 배정용 클라이언트 컴포넌트로 구현. Plan 2·3 패턴 답습: 쿠키 유저 클라이언트 + `requireCurrentMembership` + RLS + `revalidatePath`, 클라이언트 폼은 `useTransition` + `<form action>` (단일 `.click()` 금지).

**Tech Stack:** Next.js 15 (App Router, RSC + server actions + client component), Supabase (Postgres + RLS), Vitest(통합), TypeScript, Tailwind(디자인 토큰).

**설계 문서:** `docs/superpowers/specs/2026-07-07-class-edit-and-assignment-design.md`

## Global Constraints
- 패키지 매니저 **npm**. 개발 포트 **3100**. UI 텍스트 **한국어**.
- Supabase 닿는 명령(`npm test`, `test:e2e`, `db push`)은 **`dangerouslyDisableSandbox: true`**.
- **스키마 변경/마이그레이션 없음.**
- 서버 액션은 요청 group_id 불신 → 현재 멤버십 `groupId` 강제. 쓰기 **master·editor만**. viewer는 UI에서 `/settings/roster`로 리다이렉트.
- 액션은 항상 `.eq("group_id", m.groupId)`로 그룹 스코프. `assignStudents`는 대상 `classId`가 이 그룹 소속인지 **존재 검증**.
- `npm run build`는 **dev 서버 끈 상태**에서. 빌드 전 포트 3100 확인. E2E는 Playwright가 서버 소유.
- 클라이언트 폼 제출은 `useTransition`+`<form action={fn}>` 패턴(하이드레이션 no-op 회피). 단일 `.click()` 의존 금지.
- 커밋 끝에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## File Structure
**생성:** `app/(app)/settings/roster/classes/[classId]/page.tsx`(반 상세), `components/class-detail.tsx`(수정 폼 + 배정 클라이언트 컴포넌트), `tests/integration/class-assign-rls.test.ts`
**수정:** `app/actions/classes.ts`(`renameClass`→`updateClass`, `assignStudents` 추가), `app/(app)/settings/roster/classes/page.tsx`(각 반 행을 상세로 링크)

---

## Task 1 — 서버 액션: `updateClass` + `assignStudents` (+ 통합 테스트)

**Files:**
- Modify: `app/actions/classes.ts`
- Test: `tests/integration/class-assign-rls.test.ts` (Create)

**Interfaces:**
- Consumes: `requireCurrentMembership`/`CurrentMembership` (`@/lib/memberships`), `classSchema` (`@/lib/validation/student`), `createServerClient` (`@/lib/supabase/server`).
- Produces:
  - `updateClass(input: { id: string; name: string; teacherName?: string | null }): Promise<{ error?: string }>`
  - `assignStudents(input: { studentIds: string[]; classId: string | null }): Promise<{ error?: string }>`
  - (`renameClass` 제거 — `updateClass`가 대체.)

- [ ] **Step 1: 통합 테스트 작성 (실패 예정)**

Create `tests/integration/class-assign-rls.test.ts`:

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
    .insert({ name: "CA", join_code: joinCode, created_by: master.userId })
    .select("id")
    .single();
  await admin.from("memberships").insert([
    { group_id: group!.id, user_id: master.userId, role: "master", status: "active" },
    { group_id: group!.id, user_id: editor.userId, role: "editor", status: "active" },
    { group_id: group!.id, user_id: viewer.userId, role: "viewer", status: "active" },
  ]);
  return { group: group!, master, editor, viewer };
}

describe("RLS: class assignment / update", () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  it("editor can move students into a class and unassign them; group-scoped", async () => {
    const { group, editor } = await makeGroupWithRoles("CASN0001");
    const admin = adminClient();
    const asEditor = anonClient(editor.accessToken);
    const { data: cls } = await asEditor
      .from("classes").insert({ group_id: group.id, name: "믿음반" }).select("id").single();
    const { data: s1 } = await asEditor
      .from("students").insert({ group_id: group.id, name: "학생1" }).select("id").single();
    const { data: s2 } = await asEditor
      .from("students").insert({ group_id: group.id, name: "학생2" }).select("id").single();

    // 배정(추가)
    const { error: e1 } = await asEditor
      .from("students").update({ class_id: cls!.id }).in("id", [s1!.id, s2!.id]).eq("group_id", group.id);
    expect(e1).toBeNull();
    const { data: after1 } = await admin
      .from("students").select("id, class_id").in("id", [s1!.id, s2!.id]);
    expect(after1!.every((r) => r.class_id === cls!.id)).toBe(true);

    // 빼기(미배정)
    await asEditor.from("students").update({ class_id: null }).eq("id", s1!.id).eq("group_id", group.id);
    const { data: after2 } = await admin.from("students").select("class_id").eq("id", s1!.id).single();
    expect(after2!.class_id).toBeNull();
  });

  it("viewer cannot reassign a student", async () => {
    const { group, editor, viewer } = await makeGroupWithRoles("CASN0002");
    const asEditor = anonClient(editor.accessToken);
    const { data: cls } = await asEditor
      .from("classes").insert({ group_id: group.id, name: "소망반" }).select("id").single();
    const { data: st } = await asEditor
      .from("students").insert({ group_id: group.id, name: "뷰어차단" }).select("id").single();

    const asViewer = anonClient(viewer.accessToken);
    await asViewer.from("students").update({ class_id: cls!.id }).eq("id", st!.id).eq("group_id", group.id);
    const admin = adminClient();
    const { data: after } = await admin.from("students").select("class_id").eq("id", st!.id).single();
    expect(after!.class_id).toBeNull(); // viewer update had no effect
  });

  it("cannot move another group's student", async () => {
    const a = await makeGroupWithRoles("CASN0003");
    const b = await makeGroupWithRoles("CASN0004");
    const admin = adminClient();
    const { data: clsA } = await admin
      .from("classes").insert({ group_id: a.group.id, name: "A반" }).select("id").single();
    const { data: stB } = await admin
      .from("students").insert({ group_id: b.group.id, name: "B학생" }).select("id").single();

    // a의 editor가 b의 학생을 자기 반으로 끌어오려 시도 → 그룹 스코프로 무효
    const asEditorA = anonClient(a.editor.accessToken);
    await asEditorA.from("students").update({ class_id: clsA!.id }).eq("id", stB!.id).eq("group_id", a.group.id);
    const { data: after } = await admin.from("students").select("class_id").eq("id", stB!.id).single();
    expect(after!.class_id).toBeNull(); // unchanged — belongs to group b
  });
});
```

- [ ] **Step 2: 실행 → 실패(또는 부분) 확인**

Run (dangerouslyDisableSandbox): `npx vitest run tests/integration/class-assign-rls.test.ts`
Expected: 이 테스트는 RLS 동작을 직접 검증하므로 통과할 수도 있음(테이블 직접 조작). 목적은 **그룹 스코프·역할 게이트가 실제로 성립함을 고정**하는 것 — 통과 확인 후 다음 단계로. (실패하면 RLS 회귀 신호 → 조사.)

- [ ] **Step 3: `renameClass` → `updateClass`로 교체**

Modify `app/actions/classes.ts` — `renameClass` 함수를 아래 `updateClass`로 **교체**(이름 변경 + import 유지):

```ts
export async function updateClass(input: {
  id: string;
  name: string;
  teacherName?: string | null;
}): Promise<{ error?: string }> {
  const parsed = classSchema.safeParse({ name: input.name, teacherName: input.teacherName });
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const m = await requireEditor();
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("classes")
    .update({ name: parsed.data.name, teacher_name: parsed.data.teacherName })
    .eq("id", input.id)
    .eq("group_id", m.groupId);
  if (error) {
    if (error.code === "23505") return { error: "같은 이름의 반이 이미 있습니다" };
    return { error: error.message };
  }
  revalidatePath("/settings/roster/classes");
  revalidatePath("/settings/roster");
  return {};
}
```

- [ ] **Step 4: `assignStudents` 추가**

Modify `app/actions/classes.ts` — 파일 끝(예: `deleteClass` 뒤)에 추가:

```ts
// 선택한 학생들을 특정 반(classId)으로 이동, classId=null이면 미배정("빼기").
export async function assignStudents(input: {
  studentIds: string[];
  classId: string | null;
}): Promise<{ error?: string }> {
  const m = await requireEditor();
  if (!input.studentIds.length) return {};
  const supabase = await createServerClient();

  // 대상 반이 이 그룹 소속인지 존재 검증(타 그룹 class_id 방지)
  if (input.classId !== null) {
    const { data: cls } = await supabase
      .from("classes").select("id").eq("id", input.classId).eq("group_id", m.groupId).maybeSingle();
    if (!cls) return { error: "반을 찾을 수 없습니다" };
  }

  const { error } = await supabase
    .from("students")
    .update({ class_id: input.classId, updated_at: new Date().toISOString() })
    .in("id", input.studentIds)
    .eq("group_id", m.groupId);
  if (error) return { error: error.message };
  revalidatePath("/settings/roster");
  revalidatePath("/settings/roster/classes");
  return {};
}
```

- [ ] **Step 5: typecheck**

Run: `npm run typecheck`
Expected: 클린. (참고: `renameClass`를 참조하는 곳이 없어야 함 — grep로 확인: `git grep renameClass` → 결과 없음. 있으면 그 사용처도 이 태스크에서 정리.)

- [ ] **Step 6: 통합 테스트 재확인**

Run (dangerouslyDisableSandbox): `npx vitest run tests/integration/class-assign-rls.test.ts`
Expected: 3/3 PASS.

- [ ] **Step 7: 커밋**

```bash
git add app/actions/classes.ts tests/integration/class-assign-rls.test.ts
git commit -m "Add updateClass + assignStudents actions (Plan 4 Task 1)"
```

---

## Task 2 — 반 상세 페이지 + 배정 UI (동작 지점 🎉)

목표: 반 관리 목록에서 반을 탭 → 반 상세 화면에서 이름·선생님 수정 + 학생 다중 선택 배정/빼기 + (빈 반) 삭제.

**Files:**
- Create: `components/class-detail.tsx`, `app/(app)/settings/roster/classes/[classId]/page.tsx`
- Modify: `app/(app)/settings/roster/classes/page.tsx`

**Interfaces:**
- Consumes: `loadRoster`/`RosterClass`/`RosterStudent` (`@/lib/students`), `updateClass`/`assignStudents`/`deleteClass` (`@/app/actions/classes`, Task 1).
- Produces: `ClassDetail` 클라이언트 컴포넌트, 반 상세 라우트.

- [ ] **Step 1: 배정/수정 클라이언트 컴포넌트 구현**

Create `components/class-detail.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateClass, assignStudents, deleteClass } from "@/app/actions/classes";
import type { RosterStudent } from "@/lib/students";

type Member = { id: string; name: string };
type Candidate = { id: string; name: string; currentClassName: string | null };

export function ClassDetail({
  classId,
  className,
  teacherName,
  members,
  candidates,
  canDelete,
}: {
  classId: string;
  className: string;
  teacherName: string | null;
  members: Member[];
  candidates: Candidate[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function run(action: Promise<{ error?: string }>, after?: () => void) {
    setError(undefined);
    startTransition(async () => {
      const result = await action;
      if (result?.error) {
        setError(result.error);
        return;
      }
      after?.();
      router.refresh();
    });
  }

  function onSaveInfo(formData: FormData) {
    run(
      updateClass({
        id: classId,
        name: String(formData.get("name") ?? ""),
        teacherName: (formData.get("teacherName") as string) || null,
      }),
    );
  }

  function onAdd() {
    if (selected.size === 0) return;
    run(assignStudents({ studentIds: [...selected], classId }), () => setSelected(new Set()));
  }

  function onRemove(studentId: string) {
    run(assignStudents({ studentIds: [studentId], classId: null }));
  }

  function onDelete() {
    run(deleteClass({ id: classId }), () => router.push("/settings/roster/classes"));
  }

  const input = "mt-1 w-full rounded-btn border border-border bg-white px-3 py-2 text-ink";
  return (
    <div className="space-y-8">
      {/* 반 정보 수정 */}
      <form action={onSaveInfo} className="space-y-3 rounded-card border border-border/60 bg-white p-4 shadow-sm">
        <h2 className="font-bold text-ink">반 정보</h2>
        <label className="block">
          <span className="text-sm text-ink-muted">반 이름</span>
          <input name="name" required defaultValue={className} className={input} />
        </label>
        <label className="block">
          <span className="text-sm text-ink-muted">선생님 (선택)</span>
          <input name="teacherName" defaultValue={teacherName ?? ""} placeholder="선생님 이름" className={input} />
        </label>
        <button type="submit" disabled={isPending} className="w-full rounded-btn bg-sage py-2 font-medium text-white shadow-sm transition hover:bg-sage-deep disabled:opacity-50">
          {isPending ? "저장 중..." : "저장"}
        </button>
      </form>

      {error && <p className="text-sm text-danger">{error}</p>}

      {/* 이 반 학생 */}
      <section>
        <h2 className="mb-2 font-bold text-ink">이 반 학생 ({members.length})</h2>
        {members.length === 0 ? (
          <p className="text-sm text-ink-muted">아직 이 반에 학생이 없어요.</p>
        ) : (
          <ul className="space-y-2">
            {members.map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded-card border border-border/60 bg-white p-3 shadow-sm">
                <span className="text-ink">🐑 {s.name}</span>
                <button onClick={() => onRemove(s.id)} disabled={isPending} className="rounded-btn border border-border px-3 py-1 text-xs text-ink-muted transition hover:text-ink disabled:opacity-50">
                  빼기
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 학생 추가 */}
      <section>
        <h2 className="mb-2 font-bold text-ink">➕ 학생 추가</h2>
        {candidates.length === 0 ? (
          <p className="text-sm text-ink-muted">추가할 학생이 없어요.</p>
        ) : (
          <>
            <ul className="space-y-2">
              {candidates.map((s) => (
                <li key={s.id}>
                  <label className="flex items-center gap-3 rounded-card border border-border/60 bg-white p-3 shadow-sm">
                    <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="h-4 w-4" />
                    <span className="text-ink">{s.name}</span>
                    <span className="ml-auto text-xs text-ink-muted">
                      {s.currentClassName ? `현재: ${s.currentClassName}` : "미배정"}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <button onClick={onAdd} disabled={isPending || selected.size === 0} className="mt-3 w-full rounded-btn bg-sage py-2.5 font-medium text-white shadow-sm transition hover:bg-sage-deep disabled:opacity-50">
              선택한 {selected.size}명 이 반에 추가
            </button>
          </>
        )}
      </section>

      {/* 삭제 (빈 반만) */}
      {canDelete && (
        <button onClick={onDelete} disabled={isPending} className="w-full rounded-btn border border-danger py-2 text-sm text-danger transition hover:bg-unconfirmed-soft disabled:opacity-50">
          이 반 삭제
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 반 상세 페이지 구현**

Create `app/(app)/settings/roster/classes/[classId]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { loadRoster } from "@/lib/students";
import { ClassDetail } from "@/components/class-detail";

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const { canEdit, classes, students } = await loadRoster();
  if (!canEdit) redirect("/settings/roster");

  const cls = classes.find((c) => c.id === classId);
  if (!cls) notFound();

  const classNameById = new Map(classes.map((c) => [c.id, c.name]));
  const members = students
    .filter((s) => s.classId === classId)
    .map((s) => ({ id: s.id, name: s.name }));
  const candidates = students
    .filter((s) => s.classId !== classId)
    .map((s) => ({
      id: s.id,
      name: s.name,
      currentClassName: s.classId ? classNameById.get(s.classId) ?? null : null,
    }))
    // 미배정을 위로, 그다음 이름순
    .sort((a, b) => {
      if (!a.currentClassName && b.currentClassName) return -1;
      if (a.currentClassName && !b.currentClassName) return 1;
      return a.name.localeCompare(b.name, "ko");
    });

  return (
    <main className="min-h-screen bg-card pb-24">
      <div className="mx-auto max-w-md px-6 py-8">
        <Link href="/settings/roster/classes" className="text-sm text-ink-muted hover:text-ink">
          ← 반 관리
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-ink">{cls.name}</h1>
        <div className="mt-6">
          <ClassDetail
            classId={cls.id}
            className={cls.name}
            teacherName={cls.teacherName}
            members={members}
            candidates={candidates}
            canDelete={members.length === 0}
          />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: 반 관리 목록 → 상세 링크로 변경**

Modify `app/(app)/settings/roster/classes/page.tsx` — 목록의 각 `<li>`(현재 span + 빈 반 삭제 버튼)를 상세로 가는 링크로 교체. `deleteClass` import는 제거(삭제는 상세로 이동). `Link`는 이미 import됨. `<li>` 블록을 아래로 교체:

```tsx
          {classes.map((c) => {
            const n = countByClass.get(c.id) ?? 0;
            return (
              <li key={c.id}>
                <Link
                  href={`/settings/roster/classes/${c.id}`}
                  className="flex items-center justify-between rounded-card border border-border/60 bg-white p-3 shadow-sm transition hover:shadow-md"
                >
                  <span className="text-ink">
                    {c.name}
                    {c.teacherName && (
                      <span className="text-sm text-ink-muted"> · {c.teacherName} 선생님</span>
                    )}{" "}
                    <span className="text-xs text-ink-muted">({n}명)</span>
                  </span>
                  <span className="text-lg text-ink-muted">›</span>
                </Link>
              </li>
            );
          })}
```

그리고 파일 상단 import에서 `deleteClass`를 제거: `import { createClass } from "@/app/actions/classes";`

- [ ] **Step 4: 검증 (typecheck + build)**

포트 3100 비었는지 확인 후: Run `npm run typecheck && npm run build`
Expected: 클린 + `/settings/roster/classes/[classId]` 라우트가 동적(ƒ)으로 빌드.

**동작 확인(사용자):** 설정 → 학적부 → 반 관리 → 반 탭 → 이름/선생님 수정·저장 · 학생 체크해서 "추가" · 멤버 "빼기" · 학생 있는 반은 삭제 버튼 없음, 빈 반은 삭제 가능. 학적부/출석판에 배정 반영 확인.

- [ ] **Step 5: 커밋**

```bash
git add "app/(app)/settings/roster/classes/[classId]/page.tsx" components/class-detail.tsx "app/(app)/settings/roster/classes/page.tsx"
git commit -m "Slice: class detail page — edit + bulk assignment (Plan 4 Task 2)"
```

---

## 최종 검증 (Plan 4 완료)
- [ ] 포트 3100 확인 후 순차(모두 dangerouslyDisableSandbox):
```bash
rm -rf .next
npm run typecheck
npm test
npx playwright test
npm run build
```
Expected: typecheck 클린 · vitest 전부 PASS(기존 + class-assign-rls 3개) · Playwright 5/5(골든패스 무회귀) · build 성공.
- [ ] 동작 확인(사용자): 반 상세에서 이름·선생님 수정 → 학생 다중 추가/빼기 → 학적부·출석판에 반영.

---

## Self-Review (writing-plans)

**1. Spec coverage:**
- 반 이름·선생님 수정 → Task 1 `updateClass` + Task 2 수정 폼 ✅
- 명단 보고 다중 선택 배정(추가) → Task 1 `assignStudents(classId)` + Task 2 체크박스+추가 ✅
- 빼기(미배정) → Task 1 `assignStudents(null)` + Task 2 빼기 버튼 ✅
- 추가 명단에 다른 반 학생도 현재 반 라벨과 함께 표시, 미배정 위 정렬 → Task 2 candidates 계산·정렬 ✅
- 반 상세 화면(수정+배정+빈 반 삭제) → Task 2 ✅
- 그룹 스코프·존재검증·역할 게이트 → Task 1(+통합 테스트) ✅
- viewer 리다이렉트 → Task 2 page `canEdit` 가드 ✅
- 스키마 변경 없음 → 마이그레이션 태스크 없음 ✅
- 학생 상세 단건 배정 유지 → 손대지 않음 ✅

**2. Placeholder scan:** TBD/TODO 없음. 각 코드 스텝에 실제 코드. ✅

**3. Type consistency:** `updateClass`/`assignStudents` 시그니처가 Task 1 정의와 Task 2 `class-detail.tsx` 호출부 일치. `RosterStudent.classId`/`RosterClass.teacherName`은 `lib/students.ts` 기존 정의 기반. `Member`/`Candidate`는 Task 2 내부 타입(page가 계산해 props로 전달) — page의 map 결과와 컴포넌트 prop 형태 일치. `renameClass` 제거 후 잔존 참조 없음(Task 1 Step 5에서 grep 확인). ✅

**주의(구현 순서):** Task 1 → 2. Task 2는 Task 1의 액션에 의존.
