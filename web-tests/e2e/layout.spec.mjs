import { test, expect } from './fake-tv.mjs';

const SIZES = [[375, 667], [390, 844], [412, 915], [320, 640]];

for (const [w, h] of SIZES) {
  test(`one screen at ${w}x${h}: no page scroll, dock at the bottom`, async ({ page, tv }) => {
    await page.setViewportSize({ width: w, height: h });
    await tv.open();
    const m = await page.evaluate(() => {
      const main = document.getElementById('main'), d = document.documentElement;
      return { x: d.scrollWidth - innerWidth, y: d.scrollHeight - innerHeight, inner: main.scrollHeight - main.clientHeight };
    });
    expect(m.x).toBeLessThanOrEqual(0);
    expect(m.y).toBeLessThanOrEqual(0);
    if (h >= 660) expect(m.inner).toBeLessThanOrEqual(1);
    const dock = await page.locator('#dock').boundingBox();
    expect(Math.abs(dock.y + dock.height - h)).toBeLessThanOrEqual(2);
  });
}

test('landscape: pad beside the controls, nothing clipped sideways', async ({ page, tv }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await tv.open();
  const pad = await page.locator('#stage').boundingBox();
  const side = await page.locator('#controls').boundingBox();
  expect(pad.x + pad.width <= side.x || side.x + side.width <= pad.x).toBe(true);
  await expect(page.locator('#dock')).toBeInViewport();
  await expect(page.locator('#dpad')).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
});

async function smallTargets(page, scope) {
  return page.locator(`${scope} button:visible, ${scope} input:not([type=radio]):visible`).evaluateAll(els =>
    els.map(e => { const r = e.getBoundingClientRect(); return { n: e.getAttribute('aria-label') || e.textContent.trim(), w: r.width, h: r.height }; })
       .filter(t => t.w < 43.5 || t.h < 43.5));
}

test('touch targets are at least 44px at 320px wide', async ({ page, tv }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await tv.open();
  expect(await smallTargets(page, 'body')).toEqual([]);
});

for (const opener of ['More controls', 'Remote settings', 'All apps']) {
  test(`touch targets in the "${opener}" sheet`, async ({ page, tv }) => {
    await tv.open();
    await page.getByRole('button', { name: opener }).click();
    expect(await smallTargets(page, 'dialog[open]')).toEqual([]);
  });
}

test('every button has an accessible name', async ({ page, tv }) => {
  await tv.open();
  const unnamed = await page.locator('button').evaluateAll(els =>
    els.filter(e => !(e.getAttribute('aria-label') || e.textContent.trim())).map(e => e.outerHTML));
  expect(unnamed).toEqual([]);
});

test('header shows the TV name and the foreground app', async ({ page, tv }) => {
  await tv.open();
  await expect(page.locator('#headline')).toHaveText('Living Room');
  await expect(page.locator('#status-app')).toHaveText('Netflix');
});
