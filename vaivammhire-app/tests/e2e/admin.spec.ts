import { expect, test } from '@playwright/test';

test.describe('Admin shell (PRD §19.1 critical journey 1)', () => {
  test('admin dashboard renders KPIs', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText(/Open roles/)).toBeVisible();
    await expect(page.getByText(/Training labels/)).toBeVisible();
  });

  test('jobs index renders', async ({ page }) => {
    await page.goto('/admin/jobs');
    await expect(page.getByRole('heading', { name: 'Jobs' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'New job' })).toBeVisible();
  });
});
