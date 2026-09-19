import { test, expect } from "@playwright/test";

test("home page renders backend health", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("health-status")).toContainText("Backend status: ok");
  await expect(page.getByTestId("health-status")).toContainText("Adapter mode: mock");
});
