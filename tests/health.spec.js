import { test, expect } from "@playwright/test";

test("home page renders backend health", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("health-status")).toContainText("Backend status: ok", { timeout: 15000 });
  await expect(page.getByTestId("health-status")).toContainText("Adapter mode: mock", { timeout: 15000 });
});
