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
