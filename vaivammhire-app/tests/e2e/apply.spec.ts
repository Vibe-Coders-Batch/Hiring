import { expect, test } from '@playwright/test';

test.describe('Public apply flow (PRD §19.1 critical journey 2)', () => {
  test('jobs index renders', async ({ page }) => {
    await page.goto('/jobs');
    await expect(page.getByRole('heading', { name: 'Open roles' })).toBeVisible();
  });

  test('privacy page covers DPDP language', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: /Privacy policy.*DPDP/ })).toBeVisible();
    await expect(page.getByText(/anonymised/i).first()).toBeVisible();
  });

  test('delete-my-data form requires email', async ({ page }) => {
    await page.goto('/delete-my-data');
    await page.getByRole('button', { name: /verification link/i }).click();
    // HTML5 validation should block the request — input is invalid.
    await expect(page.locator('#email:invalid')).toBeVisible();
  });
});
