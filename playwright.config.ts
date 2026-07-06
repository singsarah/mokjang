import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000, // dev-mode compiles + retry-on-hydration submits need headroom
  expect: { timeout: 10_000 },
  fullyParallel: false, // sessions share one DB — serial is safer for foundation
  retries: 0,
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
    locale: "ko-KR",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3100",
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: "chromium-mobile",
      use: {
        viewport: { width: 390, height: 844 },
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      },
    },
  ],
});
