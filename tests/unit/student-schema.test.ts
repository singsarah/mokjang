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
