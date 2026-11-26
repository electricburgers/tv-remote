import { test, expect } from './fake-tv.mjs';

const dockNames = page => page.locator('#dock button:visible').evaluateAll(b => b.map(x => x.getAttribute('aria-label')));
const open = (page, name) => page.getByRole('button', { name, exact: true }).click();
const sheet = page => page.locator('dialog[open]').last();

test('default dock: four apps plus All apps', async ({ page, tv }) => {
  await tv.open();
  expect(await dockNames(page)).toEqual(['Open YouTube', 'Open Netflix', 'Open Prime', 'Open Disney+', 'All apps']);
});

test('a dock app launches', async ({ page, tv }) => {
  await tv.open();
  await open(page, 'Open Netflix');
  await expect.poll(() => tv.posts()).toContain('/api/launch/netflix');
});

test('overflow apps are in All apps, and launching closes the sheet', async ({ page, tv }) => {
  await tv.open();
  await open(page, 'All apps');
  await sheet(page).getByRole('button', { name: 'Open Kodi' }).click();
  await expect.poll(() => tv.posts()).toContain('/api/launch/kodi');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
});

test('dock size and labels', async ({ page, tv }) => {
  await tv.open();
  await open(page, 'Remote settings');
  await page.getByRole('radio', { name: '3', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Dock labels' }).uncheck();
  await page.keyboard.press('Escape');
  expect(await dockNames(page)).toEqual(['Open YouTube', 'Open Netflix', 'Open Prime', 'All apps']);
  await expect(page.locator('#dock .dock-label:visible')).toHaveCount(0);
  await page.reload();
  expect(await dockNames(page)).toHaveLength(4);
});

test('five apps still fit at 320px', async ({ page, tv }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await tv.open({ storage: { 'tvr.prefs': { dockSize: 5 } } });
  for (const b of await page.locator('#dock button').all()) {
    await expect(b).toBeInViewport({ ratio: 1 });
    expect((await b.boundingBox()).width).toBeGreaterThanOrEqual(44);
  }
});

test('navigation dock moves Back/Home/Recents to the bottom', async ({ page, tv }) => {
  await tv.open();
  await open(page, 'Remote settings');
  await page.getByRole('radio', { name: 'Navigation' }).check();
  await page.keyboard.press('Escape');
  expect(await dockNames(page)).toEqual(['Back', 'Home', 'Recent apps', 'All apps']);
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toHaveCount(1);
  await open(page, 'Home');
  await expect.poll(() => tv.keys()).toEqual([3]);
});

test('dock can be hidden and apps stay reachable', async ({ page, tv }) => {
  await tv.open({ storage: { 'tvr.prefs': { dock: 'off' } } });
  await expect(page.locator('#dock')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeVisible();
  await open(page, 'More controls');
  await sheet(page).getByRole('button', { name: 'All apps' }).click();
  await expect(sheet(page).getByRole('button', { name: 'Open YouTube' })).toBeVisible();
});

test.describe('customising', () => {
  const edit = async page => { await open(page, 'All apps'); await sheet(page).getByRole('button', { name: 'Edit apps' }).click(); };

  test('reorder with buttons (no dragging needed), persisted', async ({ page, tv }) => {
    await tv.open();
    await edit(page);
    await open(page, 'Move Kodi up');
    await open(page, 'Move Kodi up');
    await page.keyboard.press('Escape');
    expect(await dockNames(page)).toContain('Open Kodi');
    await page.reload();
    expect(await dockNames(page)).toEqual(['Open YouTube', 'Open Netflix', 'Open Prime', 'Open Kodi', 'All apps']);
  });

  test('the list marks where the dock ends', async ({ page, tv }) => {
    await tv.open();
    await edit(page);
    await expect(sheet(page).locator('[data-in-dock="true"]')).toHaveCount(4);
  });

  test('reorder keeps focus on the button just used', async ({ page, tv }) => {
    await tv.open();
    await edit(page);
    await open(page, 'Move Kodi up');
    await expect(page.getByRole('button', { name: 'Move Kodi up' })).toBeFocused();
  });

  test('add a custom app', async ({ page, tv }) => {
    await tv.open();
    await edit(page);
    await sheet(page).getByRole('button', { name: 'Add app' }).click();
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Jellyfin');
    await page.getByRole('textbox', { name: 'Package name' }).fill('org.jellyfin.androidtv');
    await open(page, 'Save');
    await sheet(page).getByRole('button', { name: 'Done editing' }).click();
    await sheet(page).getByRole('button', { name: 'Open Jellyfin' }).click();
    await expect.poll(() => tv.posts()).toContain('/api/launch/org.jellyfin.androidtv');
  });

  test('bad package names are rejected', async ({ page, tv }) => {
    await tv.open();
    await edit(page);
    await sheet(page).getByRole('button', { name: 'Add app' }).click();
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Evil');
    await page.getByRole('textbox', { name: 'Package name' }).fill('a;reboot');
    await open(page, 'Save');
    await expect(page.locator('#ed-err')).toContainText('Package');
    await expect(sheet(page)).toHaveAttribute('id', 'sheet-app');
  });

  test('long-press a dock app to edit it; delete needs two taps', async ({ page, tv }) => {
    await tv.open();
    await page.getByRole('button', { name: 'Open Netflix' }).hover();
    await page.mouse.down();
    await expect(page.locator('#sheet-app')).toHaveAttribute('open', '');
    await page.mouse.up();
    expect(tv.posts()).toEqual([]);
    await open(page, 'Delete');
    await open(page, 'Tap again to confirm');
    expect(await dockNames(page)).toEqual(['Open YouTube', 'Open Prime', 'Open Disney+', 'Open Spotify', 'All apps']);
  });

  test('reset restores the defaults', async ({ page, tv }) => {
    await tv.open({ storage: { 'tvr.apps': [] } });
    expect(await dockNames(page)).toEqual(['All apps']);
    await open(page, 'Remote settings');
    await open(page, 'Reset app buttons');
    await open(page, 'Tap again to confirm');
    await page.keyboard.press('Escape');
    expect(await dockNames(page)).toHaveLength(5);
  });

  test('v1.8 saved apps and swipe setting carry over', async ({ page, tv }) => {
    await tv.open({ storage: {
      'tvr.prefs': { theme: 'light', swipe: true },
      'tvr.apps': [{ id: 'z', label: 'Mine', target: 'com.mine.app', color: '#123456' }],
    } });
    expect(await dockNames(page)).toEqual(['Open Mine', 'All apps']);
    await expect(page.locator('#trackpad')).toBeVisible();
  });
});
