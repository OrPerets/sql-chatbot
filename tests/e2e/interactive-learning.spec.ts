import { test, expect } from '@playwright/test';

test('interactive learning loads and reflects selected PDF', async ({ page }) => {
  await page.goto('/interactive-learning?pdf=lecture01&view=list');

  await expect(page.getByRole('heading', { name: 'למידה אינטראקטיבית' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'הרצאה 1' })).toBeVisible();

  const openLink = page.getByRole('link', { name: 'פתיחה בחלון חדש' });
  await expect(openLink).toHaveAttribute('href', /lecture01\.pdf/);
});
