import { test, expect } from "@playwright/test";
import { submitUntilUrl } from "./helpers";

// 체험 모드: 가입 없이 버튼 한 번으로 더미 데이터가 담긴 1회용 그룹에 들어간다.
// (체험 계정은 demo-…@example.test — startDemo 가 48시간 뒤 자동 정리)

test.describe("Demo mode", () => {
  test("visitor starts a demo and sees seeded data with the tour guide", async ({ page }) => {
    // 랜딩 화면의 체험 버튼에서 시작 (로그인 페이지에도 같은 컴포넌트가 있음).
    await page.goto("/");

    // 시드(교사/학생/일정/지난 출석)까지 서버에서 만들므로 재시도 패턴으로 넉넉히 대기.
    await submitUntilUrl(page, /체험/, /\/settings\/teachers/);

    // 투어 카드 1단계(환영)가 떠 있다.
    await expect(page.getByText("체험 모드에 오신 걸 환영해요")).toBeVisible();

    // 교사 명단 더미가 보인다 (명단 리스트의 상세 링크로 특정).
    await expect(page.getByRole("link", { name: /김은혜/ })).toBeVisible();

    // 출석판: 더미 학생 양떼 + 반 팻말.
    await page.goto("/attendance");
    await expect(page.getByRole("button", { name: "김하늘" })).toBeVisible({ timeout: 15_000 });

    // 대시보드: 지난 3주 마감 세션이 통계·추이에 반영돼 있다 (미마감 배너 없음).
    await page.goto("/dashboard");
    await expect(page.getByText("지난 예배 출석")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("출석 추이")).toBeVisible();
    await expect(page.getByText("아직 마감하지 않은 출석이 있어요")).toHaveCount(0);

    // 추이 그래프 출석/결석 토글 — 결석 탭으로 전환되고 범례가 보인다.
    // (단일 click은 하이드레이션과 경쟁하므로 효과가 날 때까지 재시도)
    const absentToggle = page.getByRole("button", { name: "결석", exact: true });
    await expect(async () => {
      await absentToggle.click();
      await expect(absentToggle).toHaveAttribute("aria-pressed", "true");
    }).toPass();
  });
});
