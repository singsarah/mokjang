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
