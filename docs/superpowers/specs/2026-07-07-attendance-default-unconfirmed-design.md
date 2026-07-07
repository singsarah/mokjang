# 출석판 개선 — 반별 자동 시작 · 미체크→미확인 기본 (설계)

작성: 2026-07-07 · 브랜치: main에서 새 브랜치 · 기존 Plan 3(출석판) 개정

## 목적
출석을 시작하면 "확인 안 된 학생"이 한눈에 빨강으로 보이게 한다. 반별로 독립적으로 시작되어, 아직 손대지 않은 반은 흰색을 유지한다. 마지막에 빨강으로 남은 학생 = 그날 그 반의 **연락필요** 명단(이후 대시보드가 이걸 집계).

## 현재 동작 (변경 전)
- 저장 상태: `present`(초록) · `absent_with_reason`(노랑) · `unconfirmed`(빨강). **기록 없음 = 미체크(흰색)**.
- 탭 순환(현재): `미체크(null) → 출석 → 미확인 → 미체크`. 즉 미확인은 **교사가 명시적으로 만든** 상태.
- 사유칸: 미확인/사유결석일 때 표시, 사유 있으면 `absent_with_reason`, 비면 `unconfirmed` 기록 저장.
- 파일: `lib/attendance-cycle.ts`(순수 로직 `nextStatusOnTap`/`statusForReason` + 타입), `components/attendance-board.tsx`(반 탭·렌더·onTap/onReason·낙관적 UI), 서버 액션 `setAttendance`/`clearAttendance`, 로더 `loadBoard`.

## 확정 결정 — 새 모델
- **"미확인"은 저장하지 않고 자동 계산**한다(implicit). 저장되는 건 **`present`와 `absent_with_reason` 두 가지뿐**. → **새 마이그레이션/스키마 변경 없음.** 서버 액션도 변경 없음(setAttendance는 present·absent_with_reason만, "미확인/미체크로 되돌리기"는 clearAttendance=기록 삭제).
- **반 "시작됨(active)" = 그 반(현재 탭 그룹)의 학생 중 최소 1명에게 기록이 있음.** 반별로 독립.
- **화면 표시 상태(displayStatus)** — 학생별:
  - present 기록 → **출석(초록)**
  - absent_with_reason 기록 → **사유결석(노랑)**
  - 기록 없음 + 반 active → **미확인(빨강)** (implicit)
  - 기록 없음 + 반 not active → **미체크(흰색)**
- **탭 동작(토글):**
  - 출석(초록) 학생 탭 → 기록 삭제 → **미확인**(반 active면 빨강) / (그 기록이 반의 마지막이었으면 반이 다시 not active가 되어 미체크로 돌아갈 수 있음 — 허용)
  - 그 외(미확인·미체크·사유결석) 탭 → **출석**(present 기록 생성). 미체크였다면 이 순간 반이 active가 되어 나머지가 빨강으로.
- **사유칸(onReason)** — 미확인(빨강) 또는 사유결석(노랑) 학생에 표시:
  - 사유 입력(non-empty) → `absent_with_reason` 기록 저장(노랑)
  - 사유 비움(empty) → 기록 삭제 → **미확인**(빨강)로 (더 이상 `unconfirmed` 기록을 쓰지 않음)
- **전원 결석 예외:** 한 반이 아무도 present가 없으면 흰색으로 남는다. 결석자에게 사유를 하나라도 넣으면(사유결석 기록) 반이 active가 되어 나머지가 빨강이 된다. (드물어 이대로 둠.)
- **하위 호환:** 과거 `unconfirmed` 기록이 남아 있어도 "기록 있음"으로 취급되어 그 반을 active로 만들고 빨강으로 표시됨 — 새 모델과 일관. 탭하면 present로, 사유 입력하면 absent_with_reason로 정상 전환.

## 순수 로직 (lib/attendance-cycle.ts 개정)
- 유지: `AttStatus = "present" | "absent_with_reason" | "unconfirmed"`(저장 타입, 하위호환), `BoardStudent`/`BoardClass`/`BoardRecord`.
- 신규 표시 타입: `type DisplayStatus = "present" | "absent_with_reason" | "unconfirmed" | "unchecked"`.
- 신규 순수 함수(단위 테스트 대상):
  - `displayStatus(rec: BoardRecord | undefined, classActive: boolean): DisplayStatus`
    - present→"present" · absent_with_reason→"absent_with_reason" · 그 외(기록없음/과거 unconfirmed) → classActive ? "unconfirmed" : "unchecked".
  - `tapAction(rec: BoardRecord | undefined): "present" | "clear"` — 현재 present면 `"clear"`, 아니면 `"present"`.
  - `reasonAction(reason: string): { kind: "reason"; reason: string } | { kind: "clear" }` — trim 있으면 reason, 없으면 clear.
- 제거/대체: 기존 `nextStatusOnTap`(3상태 순환)·`statusForReason`(unconfirmed 반환)은 새 함수로 대체. (재수출하던 `lib/attendance.ts` 경로 유지.)

## 컴포넌트 (components/attendance-board.tsx 개정)
- `shown`(현재 탭 그룹) 계산 후 **`classActive = shown.some((s) => Boolean(records[s.id]))`**.
- 각 학생 렌더: `const d = displayStatus(records[s.id], classActive)` → `sheepCls(d)`로 색(4색: 초록/노랑/빨강/흰). 다리 등 목장 테마 유지.
- **사유칸 표시 조건**을 `d === "unconfirmed" || d === "absent_with_reason"`로.
- `onTap`: `tapAction(records[id])` → `"present"`면 `setAttendance(present)` + 낙관적 반영, `"clear"`면 `clearAttendance` + 낙관적 삭제.
- `onReason`: `reasonAction(value)` → reason이면 `setAttendance(absent_with_reason, reason)`, clear면 `clearAttendance`.
- 낙관적 UI(apply/rollback)·반 탭·날짜 네비·범례는 유지. 범례 문구는 그대로(미체크/출석/사유결석/연락필요) — 의미가 새 모델과 일치.

## 서버/데이터
- **변경 없음.** `setAttendance`(present·absent_with_reason만 사용), `clearAttendance`(삭제), `loadBoard`(records 반환) 그대로. 마이그레이션 없음. `attendance_records.status` CHECK에 'unconfirmed'가 남아 있어도 무해(더는 쓰지 않음).

## 테스트
- **단위(`tests/unit/attendance-cycle.test.ts` 개정):** `displayStatus`(4케이스 × active/not), `tapAction`(present→clear, 그 외→present), `reasonAction`(non-empty→reason, empty/공백→clear).
- **통합/E2E:** 기존 attendance-rls·골든패스 무회귀. (동작 변경은 클라이언트 표시/순환이라 RLS 영향 없음.)

## 검증(shipping bar)
`npm run typecheck && npm test && npm run test:e2e && npm run build`. dev 끄고 build.

## 범위 밖 (다음)
대시보드(연락필요 집계 = 시작된 반들의 미확인 학생), 교사 인적사항, 일정, 생일, 엑셀 업로드.
