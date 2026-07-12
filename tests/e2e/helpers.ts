import { expect, type Page } from "@playwright/test";

// In dev, a submit button on a client-component form can be clicked before
// React hydrates (making the first click a no-op), and the very first server
// action also pays a one-time compile cost. Retry the click until the expected
// navigation happens, so the flow is robust to both.
export async function submitUntilUrl(
  page: Page,
  buttonName: string | RegExp,
  url: RegExp,
) {
  await expect(async () => {
    const button = page.getByRole("button", { name: buttonName });
    if (await button.isEnabled()) await button.click();
    await expect(page).toHaveURL(url, { timeout: 12_000 });
  }).toPass({ timeout: 45_000 });
}

export async function signUp(
  page: Page,
  email: string,
  password: string,
  name: string,
) {
  await page.goto("/signup");
  await page.getByLabel("이름").fill(name);
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호", { exact: false }).fill(password);
  await page.getByLabel(/개인정보 처리 방침/).check();
  // 가입 직후엔 조직 선택(만들기/참여) 화면으로 간다.
  await submitUntilUrl(page, "가입하기", /\/select-group/);
}

// 로그인하면 조직 선택 화면이 뜬다 — groupName(없으면 첫 조직) 카드를 눌러 입장.
export async function login(
  page: Page,
  email: string,
  password: string,
  groupName?: string,
) {
  await page.goto("/login");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill(password);
  // 로그인은 이전 조직 선택을 지우므로, 활성 조직이 있는 유저는 반드시
  // 조직 선택 화면에 도착한다 (/ → /attendance → /select-group 리다이렉트 체인).
  await submitUntilUrl(page, "로그인", /\/select-group/);

  const card = groupName
    ? page.getByRole("button", { name: `조직 선택: ${groupName}` })
    : page.getByRole("button", { name: /^조직 선택:/ }).first();
  await expect(async () => {
    if (await card.isVisible()) await card.click();
    await expect(page).toHaveURL(/\/attendance/, { timeout: 8_000 });
  }).toPass({ timeout: 45_000 });
}

export function testEmail(prefix: string): string {
  return `${prefix}-${Date.now()}@example.test`;
}
