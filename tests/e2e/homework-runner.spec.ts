import { test, expect } from "@playwright/test";

test.describe("Homework runner", () => {
  test("loads runner workspace", async ({ page }) => {
    await page.goto("/homework/runner/hw-set-analytics?studentId=student-demo");
    await expect(page.getByRole("heading", { name: /identify top customers/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /run query/i })).toBeVisible();
  });
});
