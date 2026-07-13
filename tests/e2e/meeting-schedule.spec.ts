import { test, expect } from "@playwright/test";
import { signUp, submitUntilUrl, testEmail } from "./helpers";

// 조직 관리(모임 일정) E2E:
//   * 마스터가 정기 모임 요일을 설정하면 출석 화면 기본 날짜가 "가장 최근 모임일"이 된다
//   * 임시 모임을 추가하면 그날도 출석 화면에 뜨고, ◀로 이전 모임일로 이동한다
// 날짜는 앱과 동일하게 한국(Asia/Seoul) 기준으로 계산한다.

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function isoSeoul(offsetDays: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + offsetDays * 86_400_000));
}

function weekdayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]!;
}

test.describe("모임 일정(조직 관리)", () => {
  const email = testEmail("meeting");
  const password = "Passw0rd!23";

  test("요일 설정 → 최근 모임일이 기본, 임시 모임 추가 → 그날이 뜬다", async ({ page }) => {
    const yesterday = isoSeoul(-1);
    const today = isoSeoul(0);
    const yLabel = weekdayLabel(yesterday);
    const tLabel = weekdayLabel(today);

    await signUp(page, email, password, "김모임");
    await page.goto("/new-group");
    await page.getByLabel(/조직 이름/).fill("고등부");
    await submitUntilUrl(page, "조직 만들기", /\/settings\/group/);

    // 어제 요일을 정기 모임 요일로 토글.
    // 저장 확인은 리로드 후 서버 렌더 상태(aria-pressed)로 — 낙관적 UI에 속지 않게.
    const chip = () => page.getByRole("button", { name: yLabel, exact: true });
    await expect(async () => {
      if ((await chip().getAttribute("aria-pressed")) !== "true") {
        await chip().click();
        await expect(chip()).toBeEnabled({ timeout: 8_000 }); // 저장 완료(busy 해제) 대기
      }
      await page.reload();
      await expect(chip()).toHaveAttribute("aria-pressed", "true", { timeout: 8_000 });
    }).toPass({ timeout: 45_000 });

    // 출석 화면(날짜 파라미터 없음) → 어제(가장 최근 모임일)가 뜬다
    await page.goto("/attendance");
    await expect(page.getByText(`${yesterday} (${yLabel})`)).toBeVisible();

    // 오늘을 임시 모임으로 추가 — 목록에 나타나야 저장된 것.
    // 하이드레이션 전 fill은 React가 놓치고, 같은 값 재-fill은 change가 안 나므로
    // 매 시도마다 빈 값으로 리셋해 값 변화를 강제한다.
    await page.goto("/settings/group");
    await expect(async () => {
      const input = page.getByLabel("임시 모임 날짜");
      await input.fill("");
      await input.fill(today);
      const add = page.getByRole("button", { name: "추가" });
      await expect(add).toBeEnabled({ timeout: 2_000 });
      await add.click();
      await expect(page.getByText(`${today} (${tLabel})`)).toBeVisible({ timeout: 8_000 });
    }).toPass({ timeout: 45_000 });

    // 이제 출석 기본 날짜는 오늘(임시 모임)
    await page.goto("/attendance");
    await expect(page.getByText(`${today} (${tLabel})`)).toBeVisible();

    // ◀ = 이전 모임일(어제)로 이동
    await page.getByRole("link", { name: "◀" }).click();
    await expect(page).toHaveURL(new RegExp(`date=${yesterday}`));
    await expect(page.getByText(`${yesterday} (${yLabel})`)).toBeVisible();
  });
});
