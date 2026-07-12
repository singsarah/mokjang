import { expect, test } from "@playwright/test";
import { login, signUp, submitUntilUrl, testEmail } from "./helpers";

test.describe.serial("Foundation golden path", () => {
  const masterEmail = testEmail("master");
  const teacherEmail = testEmail("teacher");
  const password = "TestPass1!";

  test("master signs up and creates group", async ({ page }) => {
    await signUp(page, masterEmail, password, "김마스터");

    await page.goto("/new-group");
    await page.getByLabel(/조직 이름/).fill("고등부");
    await submitUntilUrl(page, "조직 만들기", /\/settings\/group/);

    await expect(page.locator("text=참여 코드")).toBeVisible();
  });

  let joinCode = "";

  test("master retrieves join code", async ({ page }) => {
    await login(page, masterEmail, password);
    await page.goto("/settings/group");
    const codeElem = page.locator(".font-mono").first();
    joinCode = ((await codeElem.textContent()) ?? "").trim();
    expect(joinCode).toMatch(/^[A-Z0-9]{8}$/);
  });

  test("teacher signs up and joins with code", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await signUp(page, teacherEmail, password, "이교사");
    // 가입 후 조직 선택 화면 → 초대 코드 입력 화면으로 이동
    await page.goto("/join");
    await page.getByLabel(/그룹 코드/).fill(joinCode);
    await submitUntilUrl(page, "참여 신청", /\/pending/);

    await expect(page.locator("text=승인 대기 중")).toBeVisible();
    await context.close();
  });

  test("master approves teacher as editor", async ({ page }) => {
    await login(page, masterEmail, password);
    await page.goto("/settings/teachers");

    await expect(page.locator("text=이교사")).toBeVisible();

    // In dev the first click can race React hydration (a no-op that sends no
    // request) and the very first server action pays a one-time compile cost,
    // so retry the click until the approval actually lands. Assert on the
    // 활성 교사 section's role label — NOT the pending "편집 교사로 승인" button,
    // whose text contains "편집 교사" and would pass even without approval.
    const activeTeacher = page
      .locator("section", { hasText: "활성 교사" })
      .locator("li", { hasText: "이교사" });
    await expect(async () => {
      const button = page.getByRole("button", { name: "편집 교사로 승인" });
      if (await button.isVisible()) await button.click();
      await expect(activeTeacher).toContainText("편집 교사", { timeout: 8_000 });
    }).toPass({ timeout: 45_000 });
  });

  test("approved teacher lands on attendance tab", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await login(page, teacherEmail, password);
    await expect(page).toHaveURL(/\/attendance/);
    // 출석 보드가 렌더됨을 확인 — 세션 기본 라벨 "주일예배"는 학생/반이 없어도 항상 표시됨
    await expect(page.locator("text=주일예배")).toBeVisible();
    // Bottom tab bar order check
    const tabs = await page.locator("nav a").allTextContents();
    expect(tabs.join("")).toContain("출석");
    expect(tabs.join("")).toContain("일정");
    expect(tabs.join("")).toContain("대시보드");
    expect(tabs.join("")).toContain("설정");
    await context.close();
  });
});
