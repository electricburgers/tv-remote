import { test, expect } from './fake-tv.mjs';

const open = (page, name) => page.getByRole('button', { name, exact: true }).click();

test('sheets are modal, closable three ways, and return focus', async ({ page, tv }) => {
  await tv.open();
  const opener = page.getByRole('button', { name: 'More controls' });
  const dlg = page.locator('#sheet-more');
  await opener.focus();
  await page.keyboard.press('Enter');
  await expect(dlg).toBeVisible();
  expect(await dlg.evaluate(d => d.matches(':modal'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dlg).toBeHidden();
  await expect(opener).toBeFocused();
  await opener.click();
  await dlg.getByRole('button', { name: 'Close' }).click();
  await expect(dlg).toBeHidden();
  await opener.click();
  await page.mouse.click(10, 10);
  await expect(dlg).toBeHidden();
  expect(tv.keys()).toEqual([]);
});

test('sheets sit at the bottom edge, in thumb reach', async ({ page, tv }) => {
  await tv.open();
  await open(page, 'More controls');
  await expect.poll(async () => {
    const b = await page.locator('#sheet-more').boundingBox();
    return Math.abs(b.y + b.height - page.viewportSize().height);
  }).toBeLessThanOrEqual(2);
});

test('more controls: channel, input, TV settings', async ({ page, tv }) => {
  await tv.open();
  await open(page, 'More controls');
  for (const n of ['Channel up', 'Channel down', 'Input / Source', 'TV settings']) await open(page, n);
  await expect.poll(() => tv.keys()).toEqual([166, 167, 178, 176]);
});

test('channel numpad, by tap and by keyboard', async ({ page, tv }) => {
  await tv.open();
  await open(page, 'More controls');
  await open(page, 'Channel numbers');
  await open(page, '4');
  await page.keyboard.press('0');
  await expect.poll(() => tv.keys()).toEqual([11, 7]);
});

test('live typing sends characters, backspace and enter', async ({ page, tv }) => {
  await tv.open();
  await open(page, 'Type on TV');
  const input = page.getByRole('textbox', { name: 'Text to type on the TV' });
  await expect(input).toBeFocused();
  await input.pressSequentially('hi');
  await input.press('Backspace');
  await input.press('Enter');
  await expect.poll(() => tv.keys()).toEqual([67, 66]);
  expect(tv.calls.filter(c => c.path === '/api/text').map(c => JSON.parse(c.body).text)).toEqual(['h', 'i']);
});

test('offline: banner with a working Retry', async ({ page, tv }) => {
  tv.online = false;
  await tv.open();
  await expect(page.locator('#banner')).toBeVisible();
  tv.online = true;
  await open(page, 'Retry');
  await expect(page.locator('#banner')).toBeHidden();
});

test('errors are visible above an open sheet', async ({ page, tv }) => {
  await tv.open();
  await open(page, 'More controls');
  tv.online = false;
  await open(page, 'Channel up');
  await expect(page.locator('#toast')).toBeVisible();
  expect(await page.locator('#toast').evaluate(t => t.matches(':popover-open'))).toBe(true);
});

for (const supported of [true, false]) {
  test(`haptics setting ${supported ? 'shown' : 'explained'} when vibration ${supported ? 'works' : 'is missing'}`, async ({ page, tv }) => {
    await page.addInitScript(ok => {
      Object.defineProperty(Navigator.prototype, 'vibrate', { configurable: true, value: ok ? () => true : undefined });
    }, supported);
    await tv.open();
    await open(page, 'Remote settings');
    await expect(page.getByRole('checkbox', { name: 'Haptic feedback' })).toBeVisible({ visible: supported });
    await expect(page.locator('#haptics-note')).toBeVisible({ visible: !supported });
  });
}
