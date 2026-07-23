import { expect, test } from "@playwright/test";
import { login, signUp, submitUntilUrl, testEmail } from "./helpers";

// 일정(캘린더) 탭: 일정 추가 → 목록 표시 → 수정 → 삭제.
// CLAUDE.md 함정 3: dev에서 첫 클릭이 hydration과 경쟁해 no-op이 될 수 있으므로
// 단일 .click()에 의존하지 않고, 결과 상태가 보일 때까지 재시도한다.
test.describe.serial("Calendar events", () => {
  const email = testEmail("calendar");
  const password = "TestPass1!";
  const eventTitle = `수련회-${Date.now()}`;
  const editedTitle = `${eventTitle}-수정`;

  test("master signs up, creates group, adds an event", async ({ page }) => {
    await signUp(page, email, password, "김달력");

    await page.goto("/new-group");
    await page.getByLabel(/조직 이름/).fill("고등부");
    await submitUntilUrl(page, "조직 만들기", /\/settings\/group/);

    await page.goto("/calendar");

    // 모달 열기 — 열릴 때까지 클릭 재시도 (hydration 레이스 대비)
    const titleInput = page.getByLabel(/제목/);
    await expect(async () => {
      const addButton = page.getByRole("button", { name: "일정 추가" });
      if (await addButton.isVisible()) await addButton.click();
      await expect(titleInput).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 45_000 });

    // 폼 작성 (날짜는 오늘로 기본 설정됨 — 이번 달이므로 목록에 나타남)
    await titleInput.fill(eventTitle);
    await page.getByLabel(/설명/).fill("1박 2일 여름 수련회");

    // 저장 — 목록에 나타날 때까지 재시도. 모달이 이미 닫혔으면 클릭 생략.
    const listSection = page.locator("section", { hasText: "이번 달 목록" });
    await expect(async () => {
      const save = page.getByRole("button", { name: /^저장/ });
      if (await save.isVisible()) await save.click();
      await expect(listSection.getByText(eventTitle).first()).toBeVisible({
        timeout: 8_000,
      });
    }).toPass({ timeout: 45_000 });
  });

  test("clicking the day cell shows a floating popup with the event", async ({
    page,
  }) => {
    await login(page, email, password);
    await page.goto("/calendar");

    // 일정은 오늘(KST) 날짜로 만들어졌으므로 오늘 셀을 탭한다.
    const kst = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
    }).format(new Date());
    const monthNum = Number(kst.slice(5, 7));
    const dayNum = Number(kst.slice(8, 10));
    const cell = page.getByRole("button", {
      name: `${monthNum}월 ${dayNum}일 선택`,
    });
    const dialog = page.getByRole("dialog", { name: "선택한 날짜 일정" });

    // 셀 클릭은 토글이므로, 팝업이 안 보일 때만 클릭 → 내용이 보일 때까지 재시도.
    await expect(async () => {
      if (!(await dialog.isVisible())) await cell.click();
      await expect(dialog).toContainText(eventTitle, { timeout: 5_000 });
    }).toPass({ timeout: 45_000 });

    // 날짜가 선택된 동안 목록 상단에 그 날짜 섹션이 고정된다.
    await expect(
      page.getByText(`${monthNum}월 ${dayNum}일`).first(),
    ).toBeVisible();

    // 팝업의 일정 줄 탭 → 수정 모달이 기존 제목이 채워진 채 열린다.
    const titleInput = page.getByLabel(/제목/);
    await expect(async () => {
      const row = dialog.getByRole("button", { name: new RegExp(eventTitle) });
      if (await row.isVisible()) await row.click();
      await expect(titleInput).toHaveValue(eventTitle, { timeout: 5_000 });
    }).toPass({ timeout: 45_000 });
    // 다음 테스트(목록에서 수정)가 원래 제목을 기대하므로 저장하지 않고 닫는다.
    await page.getByRole("button", { name: "취소" }).click();
  });

  test("event can be edited from the month list", async ({ page }) => {
    await login(page, email, password);

    await page.goto("/calendar");
    const listSection = page.locator("section", { hasText: "이번 달 목록" });

    // 목록의 일정 탭 → 수정 모달 열기
    const titleInput = page.getByLabel(/제목/);
    await expect(async () => {
      const row = listSection.getByRole("button", { name: new RegExp(eventTitle) });
      if (await row.isVisible()) await row.click();
      await expect(titleInput).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 45_000 });

    await titleInput.fill(editedTitle);
    await expect(async () => {
      const save = page.getByRole("button", { name: /^저장/ });
      if (await save.isVisible()) await save.click();
      await expect(listSection.getByText(editedTitle).first()).toBeVisible({
        timeout: 8_000,
      });
    }).toPass({ timeout: 45_000 });
  });

  test("event can be deleted with confirm", async ({ page }) => {
    await login(page, email, password);

    await page.goto("/calendar");
    const listSection = page.locator("section", { hasText: "이번 달 목록" });

    // window.confirm 자동 수락
    page.on("dialog", (dialog) => dialog.accept());

    const deleteButton = page.getByRole("button", { name: "이 일정 삭제" });
    await expect(async () => {
      const row = listSection.getByRole("button", { name: new RegExp(editedTitle) });
      if (await row.isVisible()) await row.click();
      await expect(deleteButton).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 45_000 });

    await expect(async () => {
      if (await deleteButton.isVisible()) await deleteButton.click();
      // 결과 상태로 검증: 목록에서 사라졌는지 (버튼 텍스트가 아니라)
      await expect(listSection.getByText(editedTitle)).toHaveCount(0, {
        timeout: 8_000,
      });
    }).toPass({ timeout: 45_000 });
  });
});
