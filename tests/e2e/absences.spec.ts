import { expect, test } from "@playwright/test";
import { login, signUp, submitUntilUrl, testEmail } from "./helpers";

// 교사 출타: 등록 → 달력 칩·팝업·목록 표시 → 삭제.
// CLAUDE.md 함정 3: 단일 .click()에 의존하지 않고 결과 상태까지 재시도.
test.describe.serial("Teacher absences", () => {
  const email = testEmail("absence");
  const password = "TestPass1!";
  const teacherName = `출타김${Date.now() % 1000000}`;

  test("master signs up, adds a teacher, registers an absence", async ({
    page,
  }) => {
    await signUp(page, email, password, "김대표");

    await page.goto("/new-group");
    await page.getByLabel(/조직 이름/).fill("고등부");
    await submitUntilUrl(page, "조직 만들기", /\/settings\/group/);

    // 교사 명단에 한 명 추가 (출타 대상)
    await page.goto("/settings/teachers/roster/new");
    await page.getByLabel(/이름/).fill(teacherName);
    await submitUntilUrl(page, /^저장/, /\/settings\/teachers$/);

    await page.goto("/calendar");

    // 출타 등록 모달 열기 — 교사 셀렉트가 보일 때까지 클릭 재시도
    const teacherSelect = page.getByLabel(/교사/);
    await expect(async () => {
      const openButton = page.getByRole("button", { name: "출타 등록" });
      if (await openButton.isVisible()) await openButton.click();
      await expect(teacherSelect).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 45_000 });

    // 교사 선택 + 사유 입력 (시작·종료일은 오늘이 기본값 — 이번 달이므로 목록에 나타남)
    await teacherSelect.selectOption({ label: teacherName });
    await page.getByLabel(/사유/).fill("해외 출장");

    // 저장 — 모달이 닫힐 때까지 재시도
    const listSection = page.locator("section", { hasText: "이번 달 목록" });
    await expect(async () => {
      const save = page.getByRole("button", { name: /^저장/ });
      if (await save.isVisible()) await save.click();
      await expect(save).toHaveCount(0, { timeout: 8_000 });
    }).toPass({ timeout: 45_000 });

    // 출타는 "생일/출타" 탭에 나온다 — 탭 전환 후 행 확인
    const peopleTab = listSection.getByRole("button", { name: "생일/출타" });
    await expect(async () => {
      if (await peopleTab.isVisible()) await peopleTab.click();
      await expect(
        listSection.getByText(`✈️ ${teacherName}`).first(),
      ).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 45_000 });
  });

  test("absence appears in the day cell chip and popup", async ({ page }) => {
    await login(page, email, password);
    await page.goto("/calendar");

    // 그리드 셀 안 gold 칩에 교사 이름이 보인다 (오늘 KST 날짜 셀)
    const kst = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
    }).format(new Date());
    const monthNum = Number(kst.slice(5, 7));
    const dayNum = Number(kst.slice(8, 10));
    const cell = page.getByRole("button", {
      name: `${monthNum}월 ${dayNum}일 선택`,
    });
    await expect(cell.getByText(teacherName)).toBeVisible({ timeout: 15_000 });

    // 셀 탭 → 팝업에 "출타중" 헤더 + 이름 표시
    const dialog = page.getByRole("dialog", { name: "선택한 날짜 일정" });
    await expect(async () => {
      if (!(await dialog.isVisible())) await cell.click();
      await expect(dialog).toContainText("출타중", { timeout: 5_000 });
      await expect(dialog).toContainText(teacherName, { timeout: 5_000 });
    }).toPass({ timeout: 45_000 });
    await expect(dialog).toContainText("해외 출장");
  });

  test("absence can be deleted from the month list", async ({ page }) => {
    await login(page, email, password);
    await page.goto("/calendar");
    const listSection = page.locator("section", { hasText: "이번 달 목록" });

    // window.confirm 자동 수락
    page.on("dialog", (dialog) => dialog.accept());

    // "생일/출타" 탭으로 전환 후 출타 행 탭 → 수정 모달의 삭제 버튼.
    // 모달이 이미 열려 있으면(오버레이가 클릭을 막음) 탭/행 클릭은 건너뛴다.
    const deleteButton = page.getByRole("button", { name: "이 출타 삭제" });
    const peopleTab = listSection.getByRole("button", { name: "생일/출타" });
    await expect(async () => {
      if (!(await deleteButton.isVisible())) {
        if (await peopleTab.isVisible()) await peopleTab.click();
        const row = listSection.getByRole("button", {
          name: new RegExp(`✈️ ${teacherName}`),
        });
        if (await row.isVisible()) await row.click();
      }
      await expect(deleteButton).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 45_000 });

    await expect(async () => {
      if (await deleteButton.isVisible()) await deleteButton.click();
      // 결과 상태로 검증: 목록에서 사라졌는지
      await expect(listSection.getByText(`✈️ ${teacherName}`)).toHaveCount(0, {
        timeout: 8_000,
      });
    }).toPass({ timeout: 45_000 });
  });
});
