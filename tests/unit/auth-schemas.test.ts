import { describe, expect, it } from "vitest";
import { signUpSchema } from "@/lib/validation/auth";

describe("signUpSchema", () => {
  it("rejects invalid email", () => {
    expect(
      signUpSchema.safeParse({
        email: "notanemail",
        password: "GoodPass1!",
        displayName: "홍길동",
        consent: true,
      }).success,
    ).toBe(false);
  });

  it("rejects password under 8 chars", () => {
    expect(
      signUpSchema.safeParse({
        email: "a@b.co",
        password: "Short1!",
        displayName: "홍길동",
        consent: true,
      }).success,
    ).toBe(false);
  });

  it("rejects password without a number", () => {
    expect(
      signUpSchema.safeParse({
        email: "a@b.co",
        password: "NoDigitsHere",
        displayName: "홍길동",
        consent: true,
      }).success,
    ).toBe(false);
  });

  it("rejects missing consent", () => {
    expect(
      signUpSchema.safeParse({
        email: "a@b.co",
        password: "GoodPass1!",
        displayName: "홍길동",
        consent: false,
      }).success,
    ).toBe(false);
  });

  it("accepts a valid payload", () => {
    expect(
      signUpSchema.safeParse({
        email: "a@b.co",
        password: "GoodPass1!",
        displayName: "홍길동",
        consent: true,
      }).success,
    ).toBe(true);
  });
});
