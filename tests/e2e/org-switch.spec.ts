import { expect, test } from "@playwright/test";
import { login, signUp, submitUntilUrl, testEmail } from "./helpers";

// 다조직: 한 계정이 두 조직에 속하면 로그인 시 조직 선택 화면에서 골라 들어가고,
// 설정의 "조직 전환"으로 언제든 다른 조직으로 이동한다. 화면 상단에 조직 이름 표시.
test.describe.serial("Multi-organization switch", () => {
  const masterEmail = testEmail("orgmaster");
  const helperEmail = testEmail("orghelper");
  const password = "TestPass1!";
  let joinCode = "";

  test("master creates org 1 and retrieves code", async ({ page }) => {
    await signUp(page, masterEmail, password, "박목사");

    await page.goto("/new-group");
    await page.getByLabel(/조직 이름/).fill("노아고등부");
    await submitUntilUrl(page, "조직 만들기", /\/settings\/group/);

    const codeElem = page.locator(".font-mono").first();
    joinCode = ((await codeElem.textContent()) ?? "").trim();
    expect(joinCode).toMatch(/^[A-Z0-9]{8}$/);
  });

  test("helper joins org 1 and also founds org 2", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await signUp(page, helperEmail, password, "김헬퍼");
    await page.goto("/join");
    await page.getByLabel(/그룹 코드/).fill(joinCode);
    // 아직 활성 조직이 없으므로 승인 대기 화면으로 간다.
    await submitUntilUrl(page, "참여 신청", /\/pending/);

    // 두 번째 조직을 직접 창설 — 창설 조직으로 바로 진입된다.
    await page.goto("/new-group");
    await page.getByLabel(/조직 이름/).fill("룻청년부");
    await submitUntilUrl(page, "조직 만들기", /\/settings\/group/);
    await context.close();
  });

  test("master approves helper", async ({ page }) => {
    await login(page, masterEmail, password);
    await page.goto("/settings/teachers");
    const activeTeacher = page
      .locator("section", { hasText: "활성 교사" })
      .locator("li", { hasText: "김헬퍼" });
    await expect(async () => {
      const button = page.getByRole("button", { name: "편집 교사로 승인" });
      if (await button.isVisible()) await button.click();
      await expect(activeTeacher).toContainText("편집 교사", { timeout: 8_000 });
    }).toPass({ timeout: 45_000 });
  });

  test("helper logs in, picks org 2, then switches to org 1", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // 로그인 → 조직 선택 화면에 두 카드 → 룻청년부로 입장
    await login(page, helperEmail, password, "룻청년부");
    await expect(page).toHaveURL(/\/attendance/);
    await expect(page.getByText("룻청년부")).toBeVisible();

    // 설정 → 조직 전환 → 노아고등부로 이동
    await page.goto("/settings");
    await expect(async () => {
      const link = page.getByRole("link", { name: /조직 전환/ });
      if (await link.isVisible()) await link.click();
      await expect(page).toHaveURL(/\/select-group/, { timeout: 8_000 });
    }).toPass({ timeout: 45_000 });

    const orgCard = page.getByRole("button", { name: "조직 선택: 노아고등부" });
    await expect(async () => {
      if (await orgCard.isVisible()) await orgCard.click();
      await expect(page).toHaveURL(/\/attendance/, { timeout: 8_000 });
    }).toPass({ timeout: 45_000 });
    await expect(page.getByText("노아고등부")).toBeVisible();
    await context.close();
  });
});
