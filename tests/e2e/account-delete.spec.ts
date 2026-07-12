import { expect, test } from "@playwright/test";
import { signUp, submitUntilUrl, testEmail } from "./helpers";

// 계정 삭제: 설정 → 계정 삭제 페이지 → 확인 체크 → 삭제 → 홈으로, 재로그인 불가.
test.describe.serial("Account deletion", () => {
  const email = testEmail("delete");
  const password = "TestPass1!";

  test("user deletes own account and can no longer log in", async ({ page }) => {
    await signUp(page, email, password, "김탈퇴");

    await page.goto("/new-group");
    await page.getByLabel(/조직 이름/).fill("고등부");
    await submitUntilUrl(page, "조직 만들기", /\/settings\/group/);

    // 설정 화면의 계정 삭제 링크 → 안내 페이지
    await page.goto("/settings");
    await expect(async () => {
      const link = page.getByRole("link", { name: "계정 삭제" });
      if (await link.isVisible()) await link.click();
      await expect(page).toHaveURL(/\/settings\/delete-account/, { timeout: 8_000 });
    }).toPass({ timeout: 45_000 });

    // 확인 체크 전에는 버튼 비활성
    const deleteButton = page.getByRole("button", { name: "계정 삭제" });
    await expect(deleteButton).toBeDisabled();

    // window.confirm 자동 수락
    page.on("dialog", (dialog) => dialog.accept());

    // 체크 → 삭제 → 홈(랜딩)으로 리다이렉트될 때까지 재시도
    await expect(async () => {
      const checkbox = page.getByRole("checkbox");
      if (!(await checkbox.isChecked())) await checkbox.check();
      if (await deleteButton.isEnabled()) await deleteButton.click();
      await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });
    }).toPass({ timeout: 60_000 });

    // 삭제된 계정으로는 로그인 불가
    await page.goto("/login");
    await page.getByLabel("이메일").fill(email);
    await page.getByLabel("비밀번호").fill(password);
    await expect(async () => {
      const loginButton = page.getByRole("button", { name: "로그인" });
      if (await loginButton.isVisible()) await loginButton.click();
      await expect(
        page.getByText("이메일 또는 비밀번호가 올바르지 않습니다"),
      ).toBeVisible({ timeout: 8_000 });
    }).toPass({ timeout: 45_000 });
  });
});
