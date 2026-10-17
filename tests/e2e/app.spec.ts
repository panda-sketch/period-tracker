import { expect, test, type Page } from '@playwright/test';

const ORIGIN = 'http://localhost:4173';

/** Fails the test if the app ever requests anything outside its own origin. */
function guardNetwork(page: Page) {
  const outside: string[] = [];
  page.context().on('request', (r) => {
    if (new URL(r.url()).origin !== ORIGIN && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) {
      outside.push(r.url());
    }
  });
  return outside;
}

async function storedText(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const r = indexedDB.open('period-tracker');
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const g = r.result.transaction('kv').objectStore('kv').get('data');
          g.onsuccess = () => resolve(JSON.stringify(g.result ?? null));
        };
      }),
  );
}

async function enterPin(page: Page, pin: string) {
  for (const d of pin) await page.getByRole('button', { name: d, exact: true }).click();
}

test('logs a period and symptoms, and keeps them after reload', async ({ page }) => {
  const outside = guardNetwork(page);
  await page.goto('/');
  await expect(page.getByText('Log your first period')).toBeVisible();
  await page.getByRole('button', { name: 'Period started today' }).click();
  await expect(page.getByText('Cycle day 1')).toBeVisible();
  await expect(page.getByText(/Period$/)).toBeVisible();

  await page.getByRole('button', { name: "Edit today's log" }).click();
  await page.getByRole('button', { name: 'Cramps' }).click();
  await page.getByRole('button', { name: 'Calm' }).click();
  await page.getByRole('textbox', { name: 'New symptom' }).fill('Migraine aura');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('textbox', { name: 'Note' }).fill('First day');
  await page.getByRole('button', { name: 'Save' }).click();

  await page.getByRole('button', { name: 'Calendar' }).click();
  await expect(page.getByRole('button', { name: /today/ })).toHaveAccessibleName(/period, medium flow.*has notes/);
  await page.getByRole('button', { name: 'Stats' }).click();
  await expect(page.getByRole('cell', { name: 'Current' })).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'Calendar' }).click();
  await page.getByRole('button', { name: /today/ }).click();
  await expect(page.getByRole('button', { name: 'Migraine aura' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('textbox', { name: 'Note' })).toHaveValue('First day');
  expect(outside).toEqual([]);
});

test('works offline once installed', async ({ page, context }) => {
  const outside = guardNetwork(page);
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // now controlled by the service worker
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Period started today' }).click();
  await expect(page.getByText('Cycle day 1')).toBeVisible();
  await context.setOffline(false);
  expect(outside).toEqual([]);
});

test('PIN lock encrypts data at rest and locks the app', async ({ page }) => {
  const outside = guardNetwork(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Period started today' }).click();
  await page.getByRole('button', { name: "Edit today's log" }).click();
  await page.getByRole('textbox', { name: 'Note' }).fill('very private note');
  await page.getByRole('button', { name: 'Save' }).click();
  expect(await storedText(page)).toContain('very private note');

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Set PIN' }).click();
  await enterPin(page, '24680');
  await enterPin(page, '24680');
  await expect(page.getByText('PIN set')).toBeVisible();
  const raw = await storedText(page);
  expect(raw).not.toContain('very private note');
  expect(raw).not.toContain('medium');

  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Enter your PIN' })).toBeVisible();
  await enterPin(page, '11111');
  await expect(page.getByText('Wrong PIN.')).toBeVisible();
  await enterPin(page, '24680');
  await expect(page.getByText('Cycle day 1')).toBeVisible();
  expect(outside).toEqual([]);
});

test('backup file round-trips after deleting all data', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Period started today' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Save backup file' }).click(),
  ]);
  const path = await download.path();

  await page.getByRole('button', { name: 'Delete all data' }).click();
  await page.getByRole('button', { name: 'Yes, delete everything' }).click();
  await page.getByRole('button', { name: 'Today' }).click();
  await expect(page.getByText('Log your first period')).toBeVisible();

  await page.getByRole('button', { name: 'Settings' }).click();
  page.once('dialog', (d) => d.accept());
  await page.locator('input[type=file]').setInputFiles(path);
  await expect(page.getByText('Backup restored.')).toBeVisible();
  await page.getByRole('button', { name: 'Today' }).click();
  await expect(page.getByText('Cycle day 1')).toBeVisible();
});

test('content security policy blocks network connections', async ({ page }) => {
  await page.goto('/');
  const blocked = await page.evaluate(async () => {
    try {
      await fetch('https://example.com/');
      return false;
    } catch {
      return true;
    }
  });
  expect(blocked).toBe(true);
});
