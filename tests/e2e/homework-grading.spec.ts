import { test, expect } from "@playwright/test";

test.describe("Homework grading", () => {
  test("shows submission list", async ({ page }) => {
    await page.goto("/homework/builder/hw-set-analytics/grade");
    await expect(page.getByText(/Submissions/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /publish grades/i })).toBeVisible();
  });
});
