import { test, expect } from './fake-tv.mjs';

const mode = (page, name) => page.getByRole('radio', { name, exact: true });

/** Drag across the trackpad with real pointer events (works in Chromium and WebKit). */
async function drag(page, dx, dy, { release = true } = {}) {
  const b = await page.locator('#trackpad').boundingBox();
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  if (dx || dy) await page.mouse.move(x + dx, y + dy, { steps: 4 });
  if (release) await page.mouse.up();
}

test('the D-pad / Swipe switch is on the main screen and persists', async ({ page, tv }) => {
  await tv.open();
  await expect(mode(page, 'D-pad')).toBeChecked();
  await expect(page.locator('#trackpad')).toBeHidden();
  await mode(page, 'Swipe').check();
  await expect(page.locator('#trackpad')).toBeVisible();
  await expect(page.locator('#dpad')).toBeHidden();
  await page.reload();
  await expect(mode(page, 'Swipe')).toBeChecked();
  await expect(page.locator('#trackpad')).toBeVisible();
});

test('D-pad buttons send their keys', async ({ page, tv }) => {
  await tv.open();
  for (const n of ['Up', 'Down', 'Left', 'Right', 'OK']) await page.getByRole('button', { name: n, exact: true }).click();
  await expect.poll(() => tv.keys()).toEqual([19, 20, 21, 22, 23]);
});

test('holding an arrow repeats and stops on release', async ({ page, tv }) => {
  await tv.open();
  await page.getByRole('button', { name: 'Down', exact: true }).hover();
  await page.mouse.down();
  await expect.poll(() => tv.keys().length).toBeGreaterThan(2);
  await page.mouse.up();
  await page.waitForTimeout(200);
  const n = tv.keys().length;
  await page.waitForTimeout(400);
  expect(tv.keys().length).toBe(n);
});

test('back, home and recents', async ({ page, tv }) => {
  await tv.open();
  for (const n of ['Back', 'Home', 'Recent apps']) await page.getByRole('button', { name: n, exact: true }).click();
  await expect.poll(() => tv.keys()).toEqual([4, 3, 187]);
});

test.describe('swipe mode', () => {
  const storage = { 'tvr.prefs': { nav: 'swipe' } };

  test('tap is OK', async ({ page, tv }) => {
    await tv.open({ storage });
    await drag(page, 0, 0);
    await expect.poll(() => tv.keys()).toEqual([23]);
  });

  test('a short swipe moves one step', async ({ page, tv }) => {
    await tv.open({ storage });
    await drag(page, 45, 0);
    await expect.poll(() => tv.keys()).toEqual([22]);
    await page.waitForTimeout(700);
    expect(tv.keys()).toEqual([22]);
  });

  test('swipe and hold keeps scrolling until release', async ({ page, tv }) => {
    await tv.open({ storage });
    await drag(page, 0, 45, { release: false });
    await expect.poll(() => tv.keys().length).toBeGreaterThan(3);
    expect(new Set(tv.keys())).toEqual(new Set([20]));
    await page.mouse.up();
    await page.waitForTimeout(200);
    const n = tv.keys().length;
    await page.waitForTimeout(400);
    expect(tv.keys().length).toBe(n);
  });

  test('losing focus stops a held swipe', async ({ page, tv }) => {
    await tv.open({ storage });
    await drag(page, 0, 45, { release: false });
    await expect.poll(() => tv.keys().length).toBeGreaterThan(2);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.waitForTimeout(200);
    const n = tv.keys().length;
    await page.waitForTimeout(500);
    expect(tv.keys().length).toBe(n);
  });

  test('pad takes over touch scrolling', async ({ page, tv }) => {
    await tv.open({ storage });
    await expect(page.locator('#trackpad')).toHaveCSS('touch-action', 'none');
  });

  test('OK stays reachable from the keyboard', async ({ page, tv }) => {
    await tv.open({ storage });
    await page.locator('#trackpad').focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => tv.keys()).toEqual([23]);
  });
});

test('volume and media controls', async ({ page, tv }) => {
  await tv.open();
  for (const n of ['Volume down', 'Mute', 'Volume up', 'Rewind', 'Play / Pause', 'Fast forward', 'Power'])
    await page.getByRole('button', { name: n, exact: true }).click();
  await expect.poll(() => tv.keys()).toEqual([25, 164, 24, 89, 85, 90, 26]);
});

test('assistant', async ({ page, tv }) => {
  await tv.open();
  await page.getByRole('button', { name: 'Google Assistant' }).click();
  await expect.poll(() => tv.posts()).toContain('/api/assistant');
});

test('left-handed mode swaps the groups but never reverses them', async ({ page, tv }) => {
  await tv.open({ storage: { 'tvr.prefs': { left: true } } });
  const x = async name => (await page.getByRole('button', { name, exact: true }).boundingBox()).x;
  expect(await x('Rewind')).toBeLessThan(await x('Volume down'));        // volume moved to the right
  expect(await x('Rewind')).toBeLessThan(await x('Fast forward'));
  expect(await x('Volume down')).toBeLessThan(await x('Volume up'));
  expect(await x('Back')).toBeLessThan(await x('Recent apps'));
});

test('desktop keyboard shortcuts', async ({ page, tv }) => {
  await tv.open();
  for (const k of ['ArrowUp', 'Enter', 'Escape', 'h', 'm']) await page.keyboard.press(k);
  await expect.poll(() => tv.keys()).toEqual([19, 23, 4, 3, 164]);
});
