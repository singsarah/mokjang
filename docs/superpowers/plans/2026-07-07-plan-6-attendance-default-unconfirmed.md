# Plan 6 — 출석판 반별 자동 시작 (미체크→미확인 기본) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 반에서 첫 체크가 들어가면 그 반의 확인 안 된 학생이 전부 빨강(미확인)으로 뜨게 한다. "미확인"은 저장하지 않고 화면에서 계산한다.

**Architecture:** 순수 표시/동작 로직(`lib/attendance-cycle.ts`)을 새 모델로 교체하고, 클라이언트 보드(`components/attendance-board.tsx`)의 렌더·탭·사유 처리를 그 위에 다시 연결한다. 서버 액션·로더·스키마는 변경 없음(저장 상태는 present·absent_with_reason뿐, "미확인/미체크로 되돌리기"=기록 삭제). 낙관적 UI·목장 테마·날짜 네비 유지.

**Tech Stack:** Next.js 15 (client component), Vitest(단위), TypeScript, Tailwind.

**설계 문서:** `docs/superpowers/specs/2026-07-07-attendance-default-unconfirmed-design.md`

## Global Constraints
- 패키지 매니저 **npm**. 포트 **3100**. UI **한국어**.
- **스키마/마이그레이션/서버 액션 변경 없음.** 저장 상태 = present·absent_with_reason만.
- 색: present=`bg-sage-deep`(초록) · absent_with_reason=`bg-gold`(노랑) · unconfirmed=`bg-danger`(빨강) · unchecked=`bg-[#FBEEE6]`(흰).
- 클라이언트 컴포넌트는 순수 로직을 **`@/lib/attendance-cycle`** 에서 import(서버 전용 `@/lib/attendance` 금지 — next/headers 끌어옴).
- `npm run build`는 dev 서버 끈 상태. 빌드 전 포트 3100 확인.
- 커밋 끝에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## File Structure
**수정:** `lib/attendance-cycle.ts`(순수 로직 교체), `components/attendance-board.tsx`(렌더/핸들러 재연결), `tests/unit/attendance-cycle.test.ts`(단위 테스트 교체)

---

## Task 1 — 순수 로직 교체 + 단위 테스트

**Files:** Modify `lib/attendance-cycle.ts`, `tests/unit/attendance-cycle.test.ts`

**Interfaces:**
- Produces: `type DisplayStatus`, `displayStatus(rec, classActive)`, `tapAction(rec)`, `reasonAction(reason)`. 유지: `AttStatus`, `BoardStudent`/`BoardClass`/`BoardRecord`. 제거: `nextStatusOnTap`, `statusForReason`.

- [ ] **Step 1: 단위 테스트 교체 (실패 예정)**

Replace `tests/unit/attendance-cycle.test.ts` 전체:

```ts
import { describe, expect, it } from "vitest";
import { displayStatus, tapAction, reasonAction } from "@/lib/attendance-cycle";

describe("displayStatus", () => {
  it("present 기록 → present", () =>
    expect(displayStatus({ status: "present", reason: null }, true)).toBe("present"));
  it("absent_with_reason 기록 → absent_with_reason", () =>
    expect(displayStatus({ status: "absent_with_reason", reason: "가족여행" }, true)).toBe("absent_with_reason"));
  it("기록 없음 + 반 active → unconfirmed", () =>
    expect(displayStatus(undefined, true)).toBe("unconfirmed"));
  it("기록 없음 + 반 not active → unchecked", () =>
    expect(displayStatus(undefined, false)).toBe("unchecked"));
  it("과거 unconfirmed 기록 + active → unconfirmed", () =>
    expect(displayStatus({ status: "unconfirmed", reason: null }, true)).toBe("unconfirmed"));
  it("과거 unconfirmed 기록 + not active → unchecked", () =>
    expect(displayStatus({ status: "unconfirmed", reason: null }, false)).toBe("unchecked"));
});

describe("tapAction", () => {
  it("present → clear(해제)", () =>
    expect(tapAction({ status: "present", reason: null })).toBe("clear"));
  it("기록 없음(미확인/미체크) → present", () =>
    expect(tapAction(undefined)).toBe("present"));
  it("absent_with_reason → present", () =>
    expect(tapAction({ status: "absent_with_reason", reason: "x" })).toBe("present"));
});

describe("reasonAction", () => {
  it("사유 있음 → reason", () =>
    expect(reasonAction("가족여행")).toEqual({ kind: "reason", reason: "가족여행" }));
  it("공백만 → clear", () => expect(reasonAction("   ")).toEqual({ kind: "clear" }));
  it("빈 문자열 → clear", () => expect(reasonAction("")).toEqual({ kind: "clear" }));
});
```

- [ ] **Step 2: 실행 → 실패 확인**

Run: `npx vitest run tests/unit/attendance-cycle.test.ts`
Expected: FAIL — `displayStatus`/`tapAction`/`reasonAction` export 없음.

- [ ] **Step 3: 순수 로직 교체**

Replace `lib/attendance-cycle.ts` 전체:

```ts
// 순수 출석 상태 로직 + 타입 — 클라이언트/서버 어디서나 import 가능.
// (lib/attendance.ts는 next/headers를 쓰는 서버 전용 loadBoard를 포함하므로
//  클라이언트 컴포넌트는 이 파일에서 import해야 함.)

// 저장 상태(DB). "unconfirmed"는 하위호환용 — 새 모델은 저장하지 않고 화면에서 계산.
export type AttStatus = "present" | "absent_with_reason" | "unconfirmed";

// 화면 표시 상태(미체크 포함).
export type DisplayStatus = "present" | "absent_with_reason" | "unconfirmed" | "unchecked";

export type BoardStudent = { id: string; name: string; classId: string | null };
export type BoardClass = { id: string; name: string; teacherName: string | null };
export type BoardRecord = { status: AttStatus; reason: string | null };

// 반이 "시작됨(active)"이면 기록 없는 학생은 미확인(빨강), 아니면 미체크(흰).
export function displayStatus(
  rec: BoardRecord | undefined,
  classActive: boolean,
): DisplayStatus {
  if (rec?.status === "present") return "present";
  if (rec?.status === "absent_with_reason") return "absent_with_reason";
  return classActive ? "unconfirmed" : "unchecked";
}

// 카드 탭: 출석이면 해제(기록 삭제 → 미확인/미체크), 아니면 출석.
export function tapAction(rec: BoardRecord | undefined): "present" | "clear" {
  return rec?.status === "present" ? "clear" : "present";
}

// 사유칸: 내용 있으면 사유결석, 비우면 해제(→ 미확인).
export type ReasonAction = { kind: "reason"; reason: string } | { kind: "clear" };
export function reasonAction(reason: string): ReasonAction {
  return reason.trim() ? { kind: "reason", reason } : { kind: "clear" };
}
```

- [ ] **Step 4: 실행 → 통과**

Run: `npx vitest run tests/unit/attendance-cycle.test.ts`
Expected: PASS (12개 케이스).

- [ ] **Step 5: 커밋**

```bash
git add lib/attendance-cycle.ts tests/unit/attendance-cycle.test.ts
git commit -m "Replace attendance cycle logic with per-class implicit unconfirmed (Plan 6 Task 1)"
```

---

## Task 2 — 보드 컴포넌트 재연결

목표: `attendance-board.tsx`가 반별 active를 계산해 미확인을 자동 표시하고, 새 탭/사유 동작을 쓴다. 목장 테마·양 다리·낙관적 UI·날짜 네비는 유지.

**Files:** Modify `components/attendance-board.tsx`

**Interfaces:** Consumes `displayStatus`/`tapAction`/`reasonAction`/`DisplayStatus` (Task 1). 서버 액션 `setAttendance`/`clearAttendance` 그대로.

- [ ] **Step 1: import 교체**

`components/attendance-board.tsx` 상단 import에서 `nextStatusOnTap, statusForReason`를 제거하고 새 함수/타입을 추가. 예:

```tsx
import {
  displayStatus,
  tapAction,
  reasonAction,
  type BoardClass,
  type BoardRecord,
  type BoardStudent,
  type DisplayStatus,
} from "@/lib/attendance-cycle";
```
(기존에 `AttStatus`만 쓰던 자리는 `DisplayStatus`로. `setAttendance`/`clearAttendance` import는 유지.)

- [ ] **Step 2: statusOf 제거, sheepCls를 DisplayStatus로**

`statusOf` 함수를 제거한다(아래 렌더에서 displayStatus로 대체). `sheepCls`의 파라미터 타입을 `DisplayStatus`로 바꾸고 unchecked 분기를 명시(색 값은 동일):

```tsx
  const sheepCls = (d: DisplayStatus) =>
    d === "present" ? "bg-sage-deep text-white border-[#3c5238]"
    : d === "absent_with_reason" ? "bg-gold border-gold-deep text-ink"
    : d === "unconfirmed" ? "bg-danger text-white border-[#b64a45]"
    : "bg-[#FBEEE6] text-ink border-[rgba(58,50,46,.35)]"; // unchecked(흰)
```

- [ ] **Step 3: onTap / onReason 교체**

`onTap`·`onReason`를 아래로 교체(낙관적 apply/rollback 헬퍼는 유지):

```tsx
  function onTap(studentId: string) {
    if (!canEdit) return;
    if (tapAction(records[studentId]) === "clear") {
      const nr = { ...records };
      delete nr[studentId];
      void apply(studentId, nr, clearAttendance({ dateISO: date, studentId }));
    } else {
      const nr = { ...records, [studentId]: { status: "present" as const, reason: null } };
      void apply(studentId, nr, setAttendance({ dateISO: date, studentId, status: "present", reason: null }));
    }
  }

  function onReason(studentId: string, reason: string) {
    if (!canEdit) return;
    const a = reasonAction(reason);
    if (a.kind === "clear") {
      const nr = { ...records };
      delete nr[studentId];
      void apply(studentId, nr, clearAttendance({ dateISO: date, studentId }));
    } else {
      const nr = { ...records, [studentId]: { status: "absent_with_reason" as const, reason: a.reason } };
      void apply(studentId, nr, setAttendance({ dateISO: date, studentId, status: "absent_with_reason", reason: a.reason }));
    }
  }
```

- [ ] **Step 4: 렌더에서 반 active + displayStatus 사용**

울타리 우리 grid에서 `shown.map(...)` 직전에 반 active를 계산하고, 각 학생의 표시 상태를 displayStatus로 구한다. 현재:

```tsx
            <div className="relative z-[1] grid grid-cols-4 gap-x-2 gap-y-4">
              {shown.map((s) => {
                const st = statusOf(s.id);
                const absent = st === "unconfirmed" || st === "absent_with_reason";
```

를 아래로 교체:

```tsx
            <div className="relative z-[1] grid grid-cols-4 gap-x-2 gap-y-4">
              {(() => {
                const classActive = shown.some((s) => Boolean(records[s.id]));
                return shown.map((s) => {
                  const d = displayStatus(records[s.id], classActive);
                  const absent = d === "unconfirmed" || d === "absent_with_reason";
```

그리고 이 map 안에서 카드 색은 `sheepCls(st)` → **`sheepCls(d)`** 로 바꾼다. map을 IIFE로 감쌌으므로 **닫는 부분도 맞춰야 한다**: 기존
```tsx
                );
              })}
              {shown.length === 0 && <p className="col-span-4 py-4 text-center text-sm text-ink">이 반에 학생이 없어요.</p>}
```
를
```tsx
                  );
                });
              })()}
              {shown.length === 0 && <p className="col-span-4 py-4 text-center text-sm text-ink">이 반에 학생이 없어요.</p>}
```
로. (즉 `shown.map` 콜백의 `return (...)`은 그대로 두고, 바깥을 `(() => { const classActive=...; return shown.map((s) => { const d=...; ... return (...); }); })()` 로 감싼다. 카드 버튼의 `${sheepCls(st)}`만 `${sheepCls(d)}`로 교체.)

**주의:** 사유 input의 표시 조건은 이미 `absent`(위에서 `d` 기반으로 재정의됨)로 되어 있으므로 그대로 동작. `records[s.id]?.reason ?? ""`도 그대로(미확인=기록없음이면 "").

- [ ] **Step 5: 검증**

포트 3100 확인 후: Run `npm run typecheck && npm run build`
Expected: 클린 + 빌드 성공(/attendance=ƒ). `statusOf`/`nextStatusOnTap`/`statusForReason` 잔존 참조 없음(`git grep -n "statusOf\|nextStatusOnTap\|statusForReason" components/attendance-board.tsx` → 없음).

**동작 확인(사용자):** 한 반에서 한 명 출석 체크 → 그 반 나머지가 빨강(미확인). 다른 반은 흰색 유지. 빨강 학생 사유 입력 → 노랑. 출석 다시 탭 → 빨강. 새로고침 유지.

- [ ] **Step 6: 커밋**

```bash
git add components/attendance-board.tsx
git commit -m "Attendance board: per-class auto-start, implicit unconfirmed (Plan 6 Task 2)"
```

---

## 최종 검증 (Plan 6 완료)
- [ ] 포트 3100 확인 후 순차(Supabase 닿는 건 dangerouslyDisableSandbox):
```bash
rm -rf .next
npm run typecheck
npm test
npx playwright test
npm run build
```
Expected: typecheck 클린 · vitest 전부 PASS(attendance-cycle 새 케이스 포함) · Playwright 5/5(무회귀) · build 성공.
- [ ] 동작 확인(사용자): 반별 자동 시작·미확인·사유·되돌리기.

---

## Self-Review (writing-plans)

**1. Spec coverage:**
- 반별 active + 미체크→미확인 자동 → Task 1 `displayStatus` + Task 2 `classActive` ✅
- 탭 토글(출석↔해제) → Task 1 `tapAction` + Task 2 `onTap` ✅
- 사유 입력/비움 → Task 1 `reasonAction` + Task 2 `onReason` ✅
- 저장은 present·absent_with_reason만, 미확인 미저장, 마이그레이션 없음 → 서버/스키마 무변경 ✅
- 하위호환(과거 unconfirmed 기록) → `displayStatus` 케이스 + 테스트 ✅
- 4색 렌더·목장 테마·양 다리·날짜 네비 유지 → Task 2 sheepCls/렌더만 최소 변경 ✅

**2. Placeholder scan:** 실제 코드만. ✅

**3. Type consistency:** `DisplayStatus`(Task1) = sheepCls 파라미터·displayStatus 반환(Task2). `tapAction` 반환 `"present"|"clear"`, `reasonAction` 반환 `ReasonAction` = Task2 onTap/onReason 분기와 일치. `AttStatus` 유지로 `app/actions/attendance.ts`·`setAttendance` 시그니처 무변경. `nextStatusOnTap`/`statusForReason` 제거 후 잔존 참조 없음(Task2 Step5 grep). ✅

**주의(구현 순서):** Task 1 → 2. Task 2는 Task 1의 새 함수에 의존.
