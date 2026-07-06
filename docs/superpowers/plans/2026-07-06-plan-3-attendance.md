# Plan 3 — 출석 체크 (출석판, 목장 테마) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 교사가 세션(날짜)마다 학생 출석을 반별로 체크하는 목장 테마 출석판을 만든다.

**Architecture:** 토대(테이블+RLS)를 먼저 세우고, 그 위를 vertical slice로 쌓는다 — 순수 상태-순환 로직 + 서버 액션 + 데이터 로더(Task 2) → 동작하는 일반 스타일 보드(Task 3) → 목장 테마 UI(Task 4) → 날짜 네비(Task 5). Plan 1·2 패턴 답습: Supabase 마이그레이션 + `database.types.ts` 수동 갱신, Zod 불필요(간단 입력), `app/actions/*` 서버 액션(쿠키 유저 클라이언트 + `requireCurrentMembership` + `revalidatePath`), 클라이언트 보드는 낙관적 UI.

**Tech Stack:** Next.js 15 (App Router, RSC + server actions + client component), Supabase (Postgres + RLS), Vitest, TypeScript, Tailwind(디자인 토큰).

**설계 문서:** `docs/superpowers/specs/2026-07-06-attendance-design.md`

## 상태 모델 (전 태스크 공통)
- 저장 status: `present` | `absent_with_reason` | `unconfirmed`. **미체크 = 레코드 없음(null).**
- 탭 순환: `null → present → unconfirmed → null` (그리고 `absent_with_reason → null`).
- 결석 상태(`unconfirmed`/`absent_with_reason`)에선 **사유 입력칸** 표시. 사유 있으면 `absent_with_reason`(노랑), 비면 `unconfirmed`(빨강·연락필요).
- 색: present=`sage-deep #4E6A47` · excused=`gold #F0C86E` · unconfirmed=`danger #D9645F` · 미체크=흰 `#FBEEE6`.

## Global Constraints
- 패키지 매니저 npm. 포트 3100. UI 한국어.
- Supabase 닿는 명령(`npm test`, `supabase db push`)은 `dangerouslyDisableSandbox: true`.
- 마이그레이션 push: `printf 'y\n' | npx supabase db push`. 새 번호는 `npx supabase migration list --linked` 확인 후(현재 마지막 `20260706000006`).
- `supabase gen types` 실패 → `lib/supabase/database.types.ts` 수동 갱신.
- 서버 액션은 요청 group_id 불신 → 현재 멤버십 groupId 강제. 쓰기 master·editor만.
- 낙관적 UI: 서버 실패 시 이전 상태로 롤백 + 한국어 안내.
- `npm run build`는 dev 서버 꺼야. Playwright는 재시도 패턴.
- 커밋 끝에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File Structure
**생성:** `supabase/migrations/20260706000007_attendance.sql`, `lib/attendance.ts`(순수 로직 + loadBoard), `app/actions/attendance.ts`, `components/attendance-board.tsx`, `tests/unit/attendance-cycle.test.ts`, `tests/integration/attendance-rls.test.ts`
**수정:** `lib/supabase/database.types.ts`(attendance 테이블), `app/(app)/attendance/page.tsx`(placeholder→실제)

---

## Task 1 (토대): 마이그레이션 — attendance 테이블 + RLS + 타입

**Files:** Create `supabase/migrations/20260706000007_attendance.sql`, `tests/integration/attendance-rls.test.ts`; Modify `lib/supabase/database.types.ts`

**Interfaces:**
- Produces: `attendance_sessions`(id, group_id, session_date, note, created_by, created_at; UNIQUE(group_id,session_date)), `attendance_records`(id, group_id, session_id, student_id, status, reason, updated_by, updated_at; UNIQUE(session_id,student_id)). RLS: 활성 멤버 read, master·editor write. Plan 1 헬퍼 `is_active_member`/`user_role_in_group` 재사용.

- [ ] **Step 1: 다음 마이그레이션 번호 확인**

Run (dangerouslyDisableSandbox): `npx supabase migration list --linked`
Expected: 마지막 `20260706000006`. 다음 `20260706000007`.

- [ ] **Step 2: RLS 통합 테스트 작성 (실패 예정)**

Create `tests/integration/attendance-rls.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, cleanup, createTestUser } from "./setup";

async function groupWithRoles(code: string) {
  const admin = adminClient();
  const master = await createTestUser();
  const editor = await createTestUser();
  const viewer = await createTestUser();
  const { data: group } = await admin
    .from("groups").insert({ name: "A", join_code: code, created_by: master.userId }).select("id").single();
  await admin.from("memberships").insert([
    { group_id: group!.id, user_id: master.userId, role: "master", status: "active" },
    { group_id: group!.id, user_id: editor.userId, role: "editor", status: "active" },
    { group_id: group!.id, user_id: viewer.userId, role: "viewer", status: "active" },
  ]);
  const { data: student } = await admin
    .from("students").insert({ group_id: group!.id, name: "학생", grade: 1 }).select("id").single();
  return { group: group!, master, editor, viewer, student: student! };
}

describe("RLS: attendance", () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  it("editor can create session + record; viewer cannot write", async () => {
    const { group, editor, viewer, student } = await groupWithRoles("ATT00001");
    const asEditor = anonClient(editor.accessToken);
    const { data: session, error: sErr } = await asEditor
      .from("attendance_sessions")
      .insert({ group_id: group.id, session_date: "2026-07-06", note: "주일예배" })
      .select("id").single();
    expect(sErr).toBeNull();
    const { error: rErr } = await asEditor.from("attendance_records").insert({
      group_id: group.id, session_id: session!.id, student_id: student.id, status: "present",
    });
    expect(rErr).toBeNull();

    // viewer write blocked
    const asViewer = anonClient(viewer.accessToken);
    await asViewer.from("attendance_records").update({ status: "unconfirmed" }).eq("session_id", session!.id);
    const admin = adminClient();
    const { data: after } = await admin.from("attendance_records").select("status").eq("session_id", session!.id).single();
    expect(after?.status).toBe("present"); // viewer update had no effect
  });

  it("other group cannot read sessions", async () => {
    const a = await groupWithRoles("ATT00002");
    const b = await groupWithRoles("ATT00003");
    const admin = adminClient();
    await admin.from("attendance_sessions").insert({ group_id: a.group.id, session_date: "2026-07-06" });
    const asB = anonClient(b.master.accessToken);
    const { data: seen } = await asB.from("attendance_sessions").select("id");
    expect(seen ?? []).toEqual([]);
  });
});
```

- [ ] **Step 3: 실행 → 실패 확인**

Run (dangerouslyDisableSandbox): `npx vitest run tests/integration/attendance-rls.test.ts`
Expected: FAIL — `relation "public.attendance_sessions" does not exist`.

- [ ] **Step 4: 마이그레이션 SQL 작성**

Create `supabase/migrations/20260706000007_attendance.sql`:

```sql
CREATE TABLE attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, session_date)
);

CREATE TABLE attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('present','absent_with_reason','unconfirmed')),
  reason text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, student_id)
);

CREATE INDEX idx_att_sessions_group_date ON attendance_sessions(group_id, session_date);
CREATE INDEX idx_att_records_session ON attendance_records(session_id);
CREATE INDEX idx_att_records_group_student ON attendance_records(group_id, student_id);

ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read att sessions" ON attendance_sessions FOR SELECT
  USING (is_active_member(group_id, auth.uid()));
CREATE POLICY "editors write att sessions" ON attendance_sessions FOR ALL
  USING (user_role_in_group(group_id, auth.uid()) IN ('master','editor'))
  WITH CHECK (user_role_in_group(group_id, auth.uid()) IN ('master','editor'));

CREATE POLICY "members read att records" ON attendance_records FOR SELECT
  USING (is_active_member(group_id, auth.uid()));
CREATE POLICY "editors write att records" ON attendance_records FOR ALL
  USING (user_role_in_group(group_id, auth.uid()) IN ('master','editor'))
  WITH CHECK (user_role_in_group(group_id, auth.uid()) IN ('master','editor'));
```

- [ ] **Step 5: push**

Run (dangerouslyDisableSandbox): `printf 'y\n' | npx supabase db push`
Expected: `Applying migration 20260706000007_attendance.sql...` 성공(edge-runtime 경고 무시).

- [ ] **Step 6: database.types.ts 수동 갱신**

Modify `lib/supabase/database.types.ts` — `public.Tables` 안(예: `audit_log` 앞)에 추가:

```ts
      attendance_records: {
        Row: {
          group_id: string
          id: string
          reason: string | null
          session_id: string
          status: string
          student_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          group_id: string
          id?: string
          reason?: string | null
          session_id: string
          status: string
          student_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          group_id?: string
          id?: string
          reason?: string | null
          session_id?: string
          status?: string
          student_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          created_at: string
          created_by: string | null
          group_id: string
          id: string
          note: string | null
          session_date: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          group_id: string
          id?: string
          note?: string | null
          session_date: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          group_id?: string
          id?: string
          note?: string | null
          session_date?: string
        }
        Relationships: []
      }
```

- [ ] **Step 7: 통과 + typecheck**

Run (dangerouslyDisableSandbox): `npx vitest run tests/integration/attendance-rls.test.ts && npm run typecheck`
Expected: PASS + 클린.

- [ ] **Step 8: 커밋**

```bash
git add supabase/migrations/20260706000007_attendance.sql lib/supabase/database.types.ts tests/integration/attendance-rls.test.ts
git commit -m "Add attendance tables + RLS (Plan 3 Task 1)"
```

---

## Task 2 — 순수 상태-순환 로직 + 서버 액션 + 보드 로더

**Files:** Create `lib/attendance.ts`, `app/actions/attendance.ts`, `tests/unit/attendance-cycle.test.ts`

**Interfaces:**
- Produces:
  - `type AttStatus = "present" | "absent_with_reason" | "unconfirmed"`
  - `nextStatusOnTap(current: AttStatus | null): AttStatus | null` — `null→present→unconfirmed→null`, `absent_with_reason→null`
  - `statusForReason(reason: string): "absent_with_reason" | "unconfirmed"` — trim 있으면 excused, 없으면 unconfirmed
  - `type BoardStudent = { id: string; name: string; classId: string | null }`
  - `type BoardClass = { id: string; name: string; teacherName: string | null }`
  - `type BoardRecord = { status: AttStatus; reason: string | null }`
  - `loadBoard(dateISO: string): Promise<{ canEdit: boolean; date: string; note: string; classes: BoardClass[]; students: BoardStudent[]; records: Record<string, BoardRecord> }>`
  - actions: `setAttendance(input: { dateISO: string; studentId: string; status: AttStatus; reason?: string | null }): Promise<{ error?: string }>`, `clearAttendance(input: { dateISO: string; studentId: string }): Promise<{ error?: string }>`

- [ ] **Step 1: 순환 로직 단위 테스트 (실패 예정)**

Create `tests/unit/attendance-cycle.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { nextStatusOnTap, statusForReason } from "@/lib/attendance";

describe("nextStatusOnTap", () => {
  it("neutral → present", () => expect(nextStatusOnTap(null)).toBe("present"));
  it("present → unconfirmed", () => expect(nextStatusOnTap("present")).toBe("unconfirmed"));
  it("unconfirmed → neutral", () => expect(nextStatusOnTap("unconfirmed")).toBeNull());
  it("absent_with_reason → neutral", () => expect(nextStatusOnTap("absent_with_reason")).toBeNull());
});

describe("statusForReason", () => {
  it("non-empty → absent_with_reason", () => expect(statusForReason("가족여행")).toBe("absent_with_reason"));
  it("blank → unconfirmed", () => expect(statusForReason("   ")).toBe("unconfirmed"));
  it("empty → unconfirmed", () => expect(statusForReason("")).toBe("unconfirmed"));
});
```

- [ ] **Step 2: 실행 → 실패 확인**

Run: `npx vitest run tests/unit/attendance-cycle.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 순수 로직 + loadBoard 구현**

Create `lib/attendance.ts`:

```ts
import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership } from "@/lib/memberships";

export type AttStatus = "present" | "absent_with_reason" | "unconfirmed";

// 탭 순환: 미체크(null) → 출석 → 미확인(사유칸) → 미체크
export function nextStatusOnTap(current: AttStatus | null): AttStatus | null {
  if (current === null) return "present";
  if (current === "present") return "unconfirmed";
  return null; // unconfirmed / absent_with_reason → 미체크
}

// 사유 입력값으로 결석 세부 상태 결정
export function statusForReason(reason: string): "absent_with_reason" | "unconfirmed" {
  return reason.trim() ? "absent_with_reason" : "unconfirmed";
}

export type BoardStudent = { id: string; name: string; classId: string | null };
export type BoardClass = { id: string; name: string; teacherName: string | null };
export type BoardRecord = { status: AttStatus; reason: string | null };

export async function loadBoard(dateISO: string): Promise<{
  canEdit: boolean;
  date: string;
  note: string;
  classes: BoardClass[];
  students: BoardStudent[];
  records: Record<string, BoardRecord>;
}> {
  const m = await requireCurrentMembership();
  const supabase = await createServerClient();
  const canEdit = m.role === "master" || m.role === "editor";

  const { data: classRows } = await supabase
    .from("classes").select("id, name, teacher_name, display_order")
    .eq("group_id", m.groupId).order("display_order", { ascending: true });

  const { data: studentRows } = await supabase
    .from("students").select("id, name, class_id")
    .eq("group_id", m.groupId).is("deleted_at", null).order("name", { ascending: true });

  // 해당 날짜 세션 + 레코드
  const { data: session } = await supabase
    .from("attendance_sessions").select("id, note")
    .eq("group_id", m.groupId).eq("session_date", dateISO).maybeSingle();

  const records: Record<string, BoardRecord> = {};
  if (session) {
    const { data: recRows } = await supabase
      .from("attendance_records").select("student_id, status, reason")
      .eq("session_id", session.id);
    for (const r of recRows ?? []) {
      records[r.student_id] = { status: r.status as AttStatus, reason: r.reason };
    }
  }

  return {
    canEdit,
    date: dateISO,
    note: session?.note ?? "주일예배",
    classes: (classRows ?? []).map((c) => ({ id: c.id, name: c.name, teacherName: c.teacher_name })),
    students: (studentRows ?? []).map((s) => ({ id: s.id, name: s.name, classId: s.class_id })),
    records,
  };
}
```

- [ ] **Step 4: 실행 → 통과**

Run: `npx vitest run tests/unit/attendance-cycle.test.ts`
Expected: PASS.

- [ ] **Step 5: 서버 액션 구현**

Create `app/actions/attendance.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership, type CurrentMembership } from "@/lib/memberships";
import type { AttStatus } from "@/lib/attendance";

async function requireEditor(): Promise<CurrentMembership> {
  const m = await requireCurrentMembership();
  if (m.role !== "master" && m.role !== "editor") throw new Error("편집 권한이 필요합니다");
  return m;
}

// 해당 날짜 세션을 보장(없으면 생성)하고 id를 반환.
async function ensureSessionId(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  groupId: string,
  userId: string,
  dateISO: string,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("attendance_sessions").select("id")
    .eq("group_id", groupId).eq("session_date", dateISO).maybeSingle();
  if (existing) return existing.id;
  const { data: created, error } = await supabase
    .from("attendance_sessions")
    .insert({ group_id: groupId, session_date: dateISO, note: "주일예배", created_by: userId })
    .select("id").single();
  if (error) return null;
  return created.id;
}

export async function setAttendance(input: {
  dateISO: string;
  studentId: string;
  status: AttStatus;
  reason?: string | null;
}): Promise<{ error?: string }> {
  const m = await requireEditor();
  const supabase = await createServerClient();
  const sessionId = await ensureSessionId(supabase, m.groupId, m.userId, input.dateISO);
  if (!sessionId) return { error: "세션 생성 실패" };

  const { error } = await supabase
    .from("attendance_records")
    .upsert(
      {
        group_id: m.groupId,
        session_id: sessionId,
        student_id: input.studentId,
        status: input.status,
        reason: input.status === "absent_with_reason" ? (input.reason ?? null) : null,
        updated_by: m.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_id,student_id" },
    );
  if (error) return { error: error.message };
  revalidatePath("/attendance");
  return {};
}

export async function clearAttendance(input: {
  dateISO: string;
  studentId: string;
}): Promise<{ error?: string }> {
  const m = await requireEditor();
  const supabase = await createServerClient();
  const { data: session } = await supabase
    .from("attendance_sessions").select("id")
    .eq("group_id", m.groupId).eq("session_date", input.dateISO).maybeSingle();
  if (!session) return {}; // 세션 없으면 지울 것도 없음
  const { error } = await supabase
    .from("attendance_records")
    .delete()
    .eq("session_id", session.id)
    .eq("student_id", input.studentId)
    .eq("group_id", m.groupId);
  if (error) return { error: error.message };
  revalidatePath("/attendance");
  return {};
}
```

- [ ] **Step 6: typecheck**

Run: `npm run typecheck`
Expected: 클린.

- [ ] **Step 7: 커밋**

```bash
git add lib/attendance.ts app/actions/attendance.ts tests/unit/attendance-cycle.test.ts
git commit -m "Add attendance cycle logic, actions, board loader (Plan 3 Task 2)"
```

---

## Task 3 — 동작하는 출석판 (Slice 1, end-to-end · 첫 동작 지점 🎉)

목표: 교사가 `/attendance` 진입 → 반별 탭 → 학생 카드 탭으로 상태 순환(출석/미확인/사유) → 즉시 저장. 스타일은 일반(목장 테마는 Task 4).

**Files:** Create `components/attendance-board.tsx`; Modify `app/(app)/attendance/page.tsx`

**Interfaces:**
- Consumes: `loadBoard`/`BoardStudent`/`BoardClass`/`BoardRecord`/`AttStatus`/`nextStatusOnTap`/`statusForReason` (Task 2), `setAttendance`/`clearAttendance` (Task 2).
- Produces: `AttendanceBoard` 클라이언트 컴포넌트.

- [ ] **Step 1: 보드 컴포넌트 구현**

Create `components/attendance-board.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import {
  nextStatusOnTap,
  statusForReason,
  type AttStatus,
  type BoardClass,
  type BoardRecord,
  type BoardStudent,
} from "@/lib/attendance";
import { setAttendance, clearAttendance } from "@/app/actions/attendance";

type RecMap = Record<string, BoardRecord>;

export function AttendanceBoard({
  date,
  note,
  canEdit,
  classes,
  students,
  initialRecords,
}: {
  date: string;
  note: string;
  canEdit: boolean;
  classes: BoardClass[];
  students: BoardStudent[];
  initialRecords: RecMap;
}) {
  const [records, setRecords] = useState<RecMap>(initialRecords);
  const [error, setError] = useState<string>();

  // 탭: 반 목록 + "반 없음"(미배정 학생 있을 때)
  const tabs = useMemo(() => {
    const t: { id: string | null; name: string; teacherName: string | null }[] = classes.map((c) => ({
      id: c.id, name: c.name, teacherName: c.teacherName,
    }));
    if (students.some((s) => !s.classId)) t.push({ id: null, name: "반 없음", teacherName: null });
    return t;
  }, [classes, students]);

  const [activeTab, setActiveTab] = useState<string | null>(tabs[0]?.id ?? null);
  const activeClass = tabs.find((t) => t.id === activeTab) ?? tabs[0];
  const shown = students.filter((s) => (s.classId ?? null) === (activeTab ?? null));

  function statusOf(id: string): AttStatus | null {
    return records[id]?.status ?? null;
  }

  async function apply(studentId: string, next: RecMap, action: Promise<{ error?: string }>) {
    const prev = records;
    setRecords(next);
    setError(undefined);
    const result = await action;
    if (result?.error) {
      setRecords(prev); // 롤백
      setError("저장에 실패했어요. 다시 시도해주세요.");
    }
  }

  function onTap(studentId: string) {
    if (!canEdit) return;
    const next = nextStatusOnTap(statusOf(studentId));
    if (next === null) {
      const nr = { ...records };
      delete nr[studentId];
      void apply(studentId, nr, clearAttendance({ dateISO: date, studentId }));
    } else {
      const nr = { ...records, [studentId]: { status: next, reason: null } };
      void apply(studentId, nr, setAttendance({ dateISO: date, studentId, status: next, reason: null }));
    }
  }

  function onReason(studentId: string, reason: string) {
    if (!canEdit) return;
    const status = statusForReason(reason);
    const nr = { ...records, [studentId]: { status, reason: status === "absent_with_reason" ? reason : null } };
    void apply(studentId, nr, setAttendance({ dateISO: date, studentId, status, reason }));
  }

  const cardCls = (st: AttStatus | null) =>
    st === "present" ? "bg-sage-deep text-white border-sage-deep"
    : st === "absent_with_reason" ? "bg-gold border-gold-deep"
    : st === "unconfirmed" ? "bg-white border-2 border-danger"
    : "bg-white border-border";

  return (
    <main className="min-h-screen bg-sage-soft pb-24">
      <div className="mx-auto max-w-md px-5 py-6">
        <div className="flex items-center justify-between">
          <span className="font-bold text-ink">{date}</span>
          <span className="rounded-tag bg-gold-soft px-3 py-1 text-xs text-ink-muted">{note}</span>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {tabs.map((t) => (
            <button
              key={t.id ?? "none"}
              onClick={() => setActiveTab(t.id)}
              className={`shrink-0 rounded-btn px-3 py-1.5 text-sm ${
                (t.id ?? null) === (activeTab ?? null)
                  ? "bg-sage-deep font-bold text-white"
                  : "border border-border bg-white text-ink-muted"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>

        {activeClass && (
          <h2 className="mt-4 font-display text-2xl font-bold text-ink">
            {activeClass.name}
            {activeClass.teacherName && (
              <span className="ml-2 text-sm font-normal text-ink-muted">{activeClass.teacherName} 선생님</span>
            )}
          </h2>
        )}

        {error && <p className="mt-2 text-sm text-danger">{error}</p>}

        <div className="mt-4 grid grid-cols-3 gap-3">
          {shown.map((s) => {
            const st = statusOf(s.id);
            const absent = st === "unconfirmed" || st === "absent_with_reason";
            return (
              <div key={s.id} className="flex flex-col items-center gap-1">
                <button
                  onClick={() => onTap(s.id)}
                  disabled={!canEdit}
                  className={`w-full rounded-card px-2 py-3 text-center text-sm font-bold ${cardCls(st)}`}
                >
                  {s.name}
                </button>
                {absent && (
                  <input
                    defaultValue={records[s.id]?.reason ?? ""}
                    onBlur={(e) => onReason(s.id, e.target.value)}
                    placeholder="사유(비우면 연락필요)"
                    disabled={!canEdit}
                    className="w-full rounded-btn border border-border px-2 py-1 text-xs text-ink"
                  />
                )}
              </div>
            );
          })}
          {shown.length === 0 && (
            <p className="col-span-3 mt-6 text-center text-ink-muted">이 반에 학생이 없어요.</p>
          )}
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: 페이지 구현**

Modify `app/(app)/attendance/page.tsx` (전체 교체):

```tsx
import { loadBoard } from "@/lib/attendance";
import { AttendanceBoard } from "@/components/attendance-board";

function todayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const iso = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayISO();
  const board = await loadBoard(iso);
  return (
    <AttendanceBoard
      date={board.date}
      note={board.note}
      canEdit={board.canEdit}
      classes={board.classes}
      students={board.students}
      initialRecords={board.records}
    />
  );
}
```

- [ ] **Step 3: 검증 (typecheck + build)**

포트 3100 비었는지 확인 후: Run `npm run typecheck && npm run build`
Expected: 클린 + `/attendance` 라우트 동적(ƒ)으로 빌드.

**동작 확인(사용자):** editor 로그인 → 출석 탭 → 반 선택 → 학생 탭(출석→미확인→미체크 순환), 미확인 시 사유칸에 사유 입력 → 노랑. 새로고침해도 유지.

- [ ] **Step 4: 커밋**

```bash
git add components/attendance-board.tsx "app/(app)/attendance/page.tsx"
git commit -m "Slice 1: working attendance board (Plan 3 Task 3)"
```

---

## Task 4 — 목장 테마 UI (Slice 2)

목표: Task 3 보드를 목장 그림처럼. 초록 배경(언덕) + 나무 팻말(반이름 손글씨 + 선생님 기본폰트) + 나무 울타리 우리(손그림) + 양떼 동그라미(상태색). 기능 동일, 마크업/클래스만 변경.

**Files:** Modify `components/attendance-board.tsx`

**Interfaces:** 변경 없음(내부 렌더만).

- [ ] **Step 1: 전역 러프 필터 + 목장 마크업으로 렌더 교체**

`components/attendance-board.tsx`의 `return (...)`를 아래로 교체(로직/훅/핸들러는 그대로 유지). 색·순환·저장 동작은 Task 3와 동일하며 표현만 목장 테마다.

```tsx
  const sheepCls = (st: AttStatus | null) =>
    st === "present" ? "bg-sage-deep text-white border-[#3c5238]"
    : st === "absent_with_reason" ? "bg-gold border-gold-deep text-ink"
    : st === "unconfirmed" ? "bg-danger text-white border-[#b64a45]"
    : "bg-[#FBEEE6] text-ink border-[rgba(58,50,46,.35)]";

  return (
    <main className="min-h-screen bg-bg pb-24">
      {/* 손그림 러프 필터 (1회) */}
      <svg width="0" height="0" className="absolute">
        <filter id="rough">
          <feTurbulence type="fractalNoise" baseFrequency="0.018 0.03" numOctaves={2} seed={7} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={6} />
        </filter>
      </svg>

      <div className="mx-auto max-w-md">
        {/* 상단 날짜/세션 */}
        <div className="flex items-center justify-between px-5 py-4">
          <span className="font-bold text-ink">{date}</span>
          <span className="rounded-tag bg-gold-soft px-3 py-1 text-xs text-ink-muted">{note}</span>
        </div>

        {/* 반 탭 */}
        <div className="flex gap-2 overflow-x-auto px-5 pb-2">
          {tabs.map((t) => (
            <button
              key={t.id ?? "none"}
              onClick={() => setActiveTab(t.id)}
              className={`shrink-0 rounded-btn px-3 py-1.5 text-sm ${
                (t.id ?? null) === (activeTab ?? null)
                  ? "bg-sage-deep font-bold text-white"
                  : "border border-border bg-white text-ink-muted"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>

        {/* 범례 */}
        <div className="flex flex-wrap justify-center gap-3 px-5 pb-2 text-[11px] text-ink-muted">
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full border border-[#b9a99a] bg-[#FBEEE6] align-middle" />미체크</span>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-sage-deep align-middle" />출석</span>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-gold align-middle" />사유결석</span>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-danger align-middle" />연락필요</span>
        </div>

        {error && <p className="px-5 text-sm text-danger">{error}</p>}

        {/* 목장 씬 */}
        <div className="relative px-3 pb-6 pt-3" style={{ background: "linear-gradient(180deg,#5F9E93 0%,#7DA98A 42%,#98BE86 100%)" }}>
          {/* 나무 팻말 */}
          {activeClass && (
            <div className="relative z-10 mx-auto w-52">
              <div className="flex justify-between px-9"><span className="block h-3.5 w-0.5 bg-[#7d5537]" /><span className="block h-3.5 w-0.5 bg-[#7d5537]" /></div>
              <div className="absolute inset-x-0 bottom-0 top-3.5 rounded-lg border-[3px] border-[#7d5537] bg-[#9a6a48]" style={{ filter: "url(#rough)" }} />
              <div className="relative flex items-baseline justify-center gap-2 px-2 pb-2.5 pt-2 text-center">
                <span className="font-display text-2xl font-bold text-[#FDF3E7]">{activeClass.name}</span>
                {activeClass.teacherName && <span className="text-xs text-[#F3E2CE]">{activeClass.teacherName} 선생님</span>}
              </div>
            </div>
          )}

          {/* 울타리 우리 */}
          <div className="relative z-[2] mt-3 rounded-2xl bg-[#A7C58C] px-3 py-5">
            <div className="pointer-events-none absolute rounded-[20px] border-[5px] border-[#8f5c44]" style={{ inset: "-4px", filter: "url(#rough)" }} />
            <div className="relative z-[1] grid grid-cols-4 gap-x-2 gap-y-4">
              {shown.map((s) => {
                const st = statusOf(s.id);
                const absent = st === "unconfirmed" || st === "absent_with_reason";
                return (
                  <div key={s.id} className="flex flex-col items-center gap-1">
                    <button
                      onClick={() => onTap(s.id)}
                      disabled={!canEdit}
                      className={`relative flex h-14 w-14 items-center justify-center border-2 text-center text-[12.5px] font-bold leading-tight shadow-sm ${sheepCls(st)}`}
                      style={{ borderRadius: "52% 48% 50% 50% / 56% 56% 44% 44%" }}
                    >
                      {s.name}
                    </button>
                    {absent && (
                      <input
                        defaultValue={records[s.id]?.reason ?? ""}
                        onBlur={(e) => onReason(s.id, e.target.value)}
                        placeholder="사유"
                        disabled={!canEdit}
                        className="w-16 rounded-btn border border-border bg-white px-1 py-0.5 text-[10px] text-ink"
                      />
                    )}
                  </div>
                );
              })}
              {shown.length === 0 && <p className="col-span-4 py-4 text-center text-sm text-ink">이 반에 학생이 없어요.</p>}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
```

(위 블록에서 이전 `cardCls`는 제거하고 `sheepCls`로 대체한다. 훅/`onTap`/`onReason`/`apply`/`tabs`/`shown` 등은 Task 3 그대로.)

- [ ] **Step 2: 검증**

Run (dev 서버 꺼진 상태): `npm run typecheck && npm run build`
Expected: 클린 + 빌드 성공.

**동작 확인:** 출석판이 초록 목장 + 나무 팻말(반이름+선생님) + 울타리 + 양떼로 보이고, 탭 순환/사유/저장이 Task 3와 동일하게 작동.

- [ ] **Step 3: 커밋**

```bash
git add components/attendance-board.tsx
git commit -m "Slice 2: pasture theme attendance board (Plan 3 Task 4)"
```

---

## Task 5 — 날짜 네비게이션 (Slice 3)

목표: 지난/다음 날짜로 이동해 그 날 출석을 조회·수정. (오늘 기본, 미래는 이동 가능하되 데이터 없으면 미체크.)

**Files:** Modify `components/attendance-board.tsx` (상단 날짜에 ◀ ▶ 링크)

**Interfaces:** 변경 없음.

- [ ] **Step 1: 날짜 ◀ ▶ 이동 추가**

`components/attendance-board.tsx` 상단 날짜 표시부를 아래로 교체. 순수 날짜 계산 함수는 컴포넌트 밖(파일 상단, `import` 아래)에 추가:

```tsx
function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}
```

날짜 표시부(목장 테마 기준 `<span className="font-bold text-ink">{date}</span>` 자리):

```tsx
          <div className="flex items-center gap-3">
            <a href={`/attendance?date=${shiftDate(date, -1)}`} className="text-lg text-ink-muted">◀</a>
            <span className="font-bold text-ink">{date}</span>
            <a href={`/attendance?date=${shiftDate(date, 1)}`} className="text-lg text-ink-muted">▶</a>
          </div>
```

(`components/attendance-board.tsx`는 `"use client"`이지만 `<a href>`로 서버 라우팅 — 페이지가 `searchParams.date`로 다시 로드된다. next/link를 써도 무방.)

- [ ] **Step 2: 검증**

Run (dev 서버 꺼진 상태): `npm run typecheck && npm run build`
Expected: 클린 + 빌드 성공.

**동작 확인:** ◀/▶ 누르면 URL `?date=` 바뀌며 그 날짜 보드 로드. 지난 날짜 세션 있으면 그 기록, 없으면 전원 미체크.

- [ ] **Step 3: 커밋**

```bash
git add components/attendance-board.tsx
git commit -m "Slice 3: date navigation (Plan 3 Task 5)"
```

---

## 최종 검증 (Plan 3 완료)
- [ ] 포트 3100 확인 후 순차(모두 dangerouslyDisableSandbox):
```bash
rm -rf .next
npm run typecheck
npm test
npx playwright test
npm run build
```
Expected: typecheck 클린 · vitest 전부 PASS(기존 + attendance-cycle 단위 + attendance-rls 통합) · Playwright 5/5(기존 골든패스 무회귀) · build 성공.
- [ ] 동작 확인(사용자): 출석판에서 반 선택 → 학생 체크(출석/사유/연락필요) → 날짜 이동 → 유지 확인.

---

## Self-Review (writing-plans)

**1. Spec coverage:**
- attendance_sessions/records + RLS → Task 1 ✅
- 상태 순환/사유 로직(순수) → Task 2 ✅ · 반별 탭·보드·저장 → Task 3 ✅
- 목장 테마(팻말+선생님·울타리·양떼·범례) → Task 4 ✅
- 날짜 네비 → Task 5 ✅
- 하루 1세션·자동생성("주일예배") → Task 2 `ensureSessionId` ✅
- viewer 읽기전용 → Task 3 `canEdit` 가드 + RLS(Task 1) ✅
- 낙관적 UI+롤백 → Task 3 `apply` ✅
- 제외(통계/엑셀/알림) → 계획에 없음(의도적) ✅

**2. Placeholder scan:** TBD/TODO 없음. 각 코드 스텝에 실제 코드. ✅

**3. Type consistency:** `AttStatus`, `nextStatusOnTap`, `statusForReason`, `loadBoard` 반환형, `setAttendance`/`clearAttendance` 시그니처가 Task 2 정의와 Task 3·4·5 사용부 일치. `BoardClass.teacherName`은 Plan 2에서 추가된 `classes.teacher_name` 기반. Task 4는 Task 3의 훅/핸들러를 유지하고 `cardCls`→`sheepCls` 교체만 — 구현자는 렌더 블록만 교체하고 로직은 보존. ✅

**주의(구현 순서):** Task 1 → 2 → 3 → 4 → 5 순. Task 4/5는 Task 3의 `attendance-board.tsx`를 확장하므로 이전 태스크 완료 후 진행.
