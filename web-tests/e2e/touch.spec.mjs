// Real touch input (pointerType "touch"), which behaves unlike a mouse: implicit capture,
// scroll cancellation. Only Chromium exposes a way to synthesise it (CDP).
import { test, expect } from './fake-tv.mjs';

test.skip(({ browserName }) => browserName !== 'chromium', 'needs CDP');

async function touch(page, selector, dx = 0, dy = 0) {
  const b = await page.locator(selector).boundingBox();
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  const cdp = await page.context().newCDPSession(page);
  const send = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  await send('touchStart', [{ x, y }]);
  if (dx || dy) for (let i = 1; i <= 8; i++) await send('touchMove', [{ x: x + dx * i / 8, y: y + dy * i / 8 }]);
  await send('touchEnd', []);
}

test('touch tap on a D-pad arrow sends one key', async ({ page, tv }) => {
  await tv.open();
  await touch(page, '.d-up');
  await page.waitForTimeout(500);
  expect(tv.keys()).toEqual([19]);
});

test('a finger that slides off a button sends nothing', async ({ page, tv }) => {
  await tv.open();
  await touch(page, '[aria-label="Power"]', -150, 200);
  await page.waitForTimeout(500);
  expect(tv.keys()).toEqual([]);
});

test('touch swipe and touch tap on the trackpad', async ({ page, tv }) => {
  await tv.open({ storage: { 'tvr.prefs': { nav: 'swipe' } } });
  await touch(page, '#trackpad', -45, 0);
  await expect.poll(() => tv.keys()).toEqual([21]);
  await touch(page, '#trackpad');
  await expect.poll(() => tv.keys()).toEqual([21, 23]);
});

test('touch tap launches a dock app once', async ({ page, tv }) => {
  await tv.open();
  await touch(page, '#dock [aria-label="Open YouTube"]');
  await page.waitForTimeout(500);
  expect(tv.posts()).toEqual(['/api/launch/youtube']);
});
