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
  await submitUntilUrl(page, "가입하기", /\/join/);
}

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill(password);
  // Login redirects to "/", which then re-routes by membership status; just
  // wait until we've left /login.
  await submitUntilUrl(page, "로그인", /^(?!.*\/login).*$/);
}

export function testEmail(prefix: string): string {
  return `${prefix}-${Date.now()}@example.test`;
}
