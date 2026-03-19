import { expect, test } from '@playwright/test';

const routes = [
  { path: '/employees', name: 'employees' },
  { path: '/leave', name: 'leave' },
  { path: '/payroll', name: 'payroll' },
  { path: '/recruitment', name: 'recruitment' },
  { path: '/recruitment/jobs', name: 'recruitment-jobs' },
  { path: '/recruitment/interviews', name: 'recruitment-interviews' },
];

test.describe('Dashboard visual snapshots', () => {
  for (const route of routes) {
    test(`captures ${route.name} page`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: 'networkidle' });
      await page.setViewportSize({ width: 1440, height: 900 });
      await expect(page).toHaveScreenshot(`${route.name}-desktop.png`, {
        fullPage: true,
      });
    });

    test(`captures ${route.name} mobile`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: 'networkidle' });
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page).toHaveScreenshot(`${route.name}-mobile.png`, {
        fullPage: true,
      });
    });
  }
});
