import { expect, test } from "@playwright/test";
import { login, signUp, submitUntilUrl, testEmail } from "./helpers";

// 회의록 탭: 작성 → 목록 표시 → 상세에서 전체 내용 → 수정.
// CLAUDE.md 함정 3: 단일 .click()에 의존하지 않고 결과 상태가 보일 때까지 재시도.
test.describe.serial("Meeting minutes", () => {
  const email = testEmail("minutes");
  const password = "TestPass1!";
  const title = `교사회의-${Date.now()}`;
  const editedTitle = `${title}-수정`;
  const content = "참석: 김교사, 이교사\n\n1. 수련회 준비\n2. 다음 달 일정";

  test("master signs up, creates group, writes a minute", async ({ page }) => {
    await signUp(page, email, password, "김회의");

    await page.goto("/new-group");
    await page.getByLabel(/그룹 이름/).fill("고등부");
    await submitUntilUrl(page, "그룹 만들기", /\/settings\/group/);

    // 작성 페이지로 이동해 폼 작성
    await page.goto("/minutes/new");
    const titleInput = page.getByLabel(/제목/);
    await expect(titleInput).toBeVisible({ timeout: 15_000 });
    await titleInput.fill(title);
    await page.getByLabel(/내용/).fill(content);

    // 저장 — 목록에 나타날 때까지 재시도
    await expect(async () => {
      const save = page.getByRole("button", { name: /^저장/ });
      if (await save.isVisible()) await save.click();
      await expect(page).toHaveURL(/\/minutes$/, { timeout: 8_000 });
      await expect(page.getByText(title).first()).toBeVisible({ timeout: 8_000 });
    }).toPass({ timeout: 45_000 });
  });

  test("detail page shows the full content", async ({ page }) => {
    await login(page, email, password);
    await page.goto("/minutes");

    // 카드 클릭 → 상세로 이동할 때까지 재시도
    await expect(async () => {
      const card = page.getByRole("link", { name: new RegExp(title) });
      if (await card.isVisible()) await card.click();
      await expect(page).toHaveURL(/\/minutes\/[0-9a-f-]{36}$/, { timeout: 8_000 });
    }).toPass({ timeout: 45_000 });

    // 전체 내용(여러 줄)이 그대로 보인다
    await expect(page.getByText("1. 수련회 준비")).toBeVisible();
    await expect(page.getByText("2. 다음 달 일정")).toBeVisible();
  });

  test("minute can be edited", async ({ page }) => {
    await login(page, email, password);
    await page.goto("/minutes");

    await expect(async () => {
      const card = page.getByRole("link", { name: new RegExp(title) });
      if (await card.isVisible()) await card.click();
      await expect(page.getByRole("link", { name: "수정" })).toBeVisible({ timeout: 8_000 });
    }).toPass({ timeout: 45_000 });

    await expect(async () => {
      const editLink = page.getByRole("link", { name: "수정" });
      if (await editLink.isVisible()) await editLink.click();
      await expect(page.getByLabel(/제목/)).toBeVisible({ timeout: 8_000 });
    }).toPass({ timeout: 45_000 });

    await page.getByLabel(/제목/).fill(editedTitle);
    await expect(async () => {
      const save = page.getByRole("button", { name: /^저장/ });
      if (await save.isVisible()) await save.click();
      // 저장 후 상세로 복귀 — 수정된 제목이 보일 때까지
      await expect(
        page.getByRole("heading", { name: editedTitle }),
      ).toBeVisible({ timeout: 8_000 });
    }).toPass({ timeout: 45_000 });
  });
});
