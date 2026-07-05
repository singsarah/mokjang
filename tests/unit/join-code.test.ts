import { describe, expect, it } from "vitest";
import { generateJoinCode } from "@/lib/join-code";

describe("generateJoinCode", () => {
  it("returns exactly 8 characters", () => {
    for (let i = 0; i < 100; i++) {
      expect(generateJoinCode()).toHaveLength(8);
    }
  });

  it("uses only unambiguous uppercase alphanumerics", () => {
    // Excludes: 0, O, 1, I, L (visually confusable)
    const ALLOWED = /^[A-HJ-KM-NP-Z2-9]{8}$/;
    for (let i = 0; i < 100; i++) {
      expect(generateJoinCode()).toMatch(ALLOWED);
    }
  });

  it("produces distinct codes across many calls", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 1000; i++) codes.add(generateJoinCode());
    expect(codes.size).toBeGreaterThan(990);
  });
});
