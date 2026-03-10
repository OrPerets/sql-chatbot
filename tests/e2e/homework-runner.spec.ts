import { test, expect } from "@playwright/test";

test.describe("Homework runner", () => {
  test("lists multiple homework sets with availability states", async ({ page }) => {
    await page.route("**/api/homework", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              id: "hw-open",
              title: "Open Homework",
              courseId: "DB101",
              questionOrder: ["q1", "q2"],
              dueAt: "2099-03-12T20:00:00.000Z",
              availableFrom: "2099-03-10T08:00:00.000Z",
              availableUntil: "2099-03-12T20:00:00.000Z",
              availabilityState: "open",
              availabilityMessage: "זמין להגשה עד 12.03.2099, 20:00",
            },
            {
              id: "hw-upcoming",
              title: "Upcoming Homework",
              courseId: "DB102",
              questionOrder: ["q1"],
              dueAt: "2099-03-20T20:00:00.000Z",
              availableFrom: "2099-03-15T08:00:00.000Z",
              availableUntil: "2099-03-20T20:00:00.000Z",
              availabilityState: "upcoming",
              availabilityMessage: "שיעור הבית ייפתח ב-15.03.2099, 08:00",
            },
          ],
          page: 1,
          totalPages: 1,
          totalItems: 2,
        }),
      });
    });

    await page.goto("/homework/start");

    await expect(page.getByRole("heading", { name: "שיעורי בית פתוחים" })).toBeVisible();
    await expect(page.getByText("Open Homework")).toBeVisible();
    await expect(page.getByText("Upcoming Homework")).toBeVisible();
    await expect(page.getByText("פתוח")).toBeVisible();
    await expect(page.getByText("נפתח בקרוב")).toBeVisible();
    await expect(page.getByRole("button", { name: "כניסה למטלה" })).toBeVisible();
    await expect(page.getByRole("button", { name: "פרטי זמינות" })).toBeVisible();
  });

  test("shows direct-entry status for upcoming and closed homework", async ({ page }) => {
    await page.route("**/api/homework/future-set", async (route) => {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          error: "שיעור הבית ייפתח ב-10.03.2099, 08:00",
          accessible: false,
          availabilityState: "upcoming",
          availableFrom: "2099-03-10T08:00:00.000Z",
          availableUntil: "2099-03-12T20:00:00.000Z",
        }),
      });
    });

    await page.goto("/homework/start/future-set");
    await expect(page.getByRole("heading", { name: "שיעור הבית אינו פתוח כרגע" })).toBeVisible();
    await expect(page.getByText("שיעור הבית ייפתח ב-10.03.2099, 08:00")).toBeVisible();
    await expect(page.getByText("נפתח בקרוב")).toBeVisible();

    await page.unroute("**/api/homework/future-set");
    await page.route("**/api/homework/closed-set", async (route) => {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          error: "חלון ההגשה נסגר ב-02.03.2099, 20:00",
          accessible: false,
          availabilityState: "closed",
          availableFrom: "2099-03-01T08:00:00.000Z",
          availableUntil: "2099-03-02T20:00:00.000Z",
        }),
      });
    });

    await page.goto("/homework/start/closed-set");
    await expect(page.getByRole("heading", { name: "שיעור הבית אינו פתוח כרגע" })).toBeVisible();
    await expect(page.getByText("חלון ההגשה נסגר ב-02.03.2099, 20:00")).toBeVisible();
    await expect(page.getByText("נסגר")).toBeVisible();
  });

  test("loads runner workspace", async ({ page }) => {
    await page.goto("/homework/runner/hw-set-analytics?studentId=student-demo");
    await expect(page.getByRole("heading", { name: /identify top customers/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /run query/i })).toBeVisible();
    await expect(page.getByText("מבנה הנתונים")).toBeVisible();
    await expect(page.getByText("מה צריך לעשות?")).toBeVisible();
    await expect(page.getByText("מה אמור להתקבל?")).toBeVisible();
  });
});
