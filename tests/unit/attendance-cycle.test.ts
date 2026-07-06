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
