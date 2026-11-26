import { test, expect } from './fake-tv.mjs';

const theme = page => page.evaluate(() => document.documentElement.dataset.theme);

test('auto theme follows the system, live', async ({ page, tv }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await tv.open();
  expect(await theme(page)).toBe('light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => theme(page)).toBe('dark');
});

test('header button flips light/dark in one tap and persists', async ({ page, tv }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await tv.open();
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  expect(await theme(page)).toBe('light');
  await page.reload();
  expect(await theme(page)).toBe('light');
  await expect(page.getByRole('button', { name: 'Switch to dark mode' })).toBeVisible();
});

test('settings offers Auto, Light and Dark', async ({ page, tv }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await tv.open();
  await page.getByRole('button', { name: 'Remote settings' }).click();
  await page.getByRole('radio', { name: 'Light' }).check();
  expect(await theme(page)).toBe('light');
  await page.getByRole('radio', { name: 'Auto' }).check();
  expect(await theme(page)).toBe('dark');
});

test('browser chrome colour matches the theme', async ({ page, tv }) => {
  await tv.open({ storage: { 'tvr.prefs': { theme: 'light' } } });
  const [meta, bg] = await page.evaluate(() => [document.querySelector('meta[name=theme-color]').content,
    getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()]);
  expect(meta).toBe(bg);
});

// WCAG AA contrast for the text tokens against the surfaces they sit on.
for (const t of ['light', 'dark']) {
  test(`${t} theme text meets 4.5:1`, async ({ page, tv }) => {
    await tv.open({ storage: { 'tvr.prefs': { theme: t } } });
    const ratios = await page.evaluate(() => {
      const css = getComputedStyle(document.documentElement);
      const lum = name => {
        const hex = css.getPropertyValue(name).trim();
        if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`${name} must be #rrggbb, got "${hex}"`);
        const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
          .map(c => c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
        return .2126 * r + .7152 * g + .0722 * b;
      };
      const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + .05) / (y + .05); };
      const out = {};
      for (const fg of ['--text', '--text-dim', '--accent-text', '--danger'])
        for (const bg of ['--bg', '--surface', '--sheet']) out[`${fg} on ${bg}`] = ratio(fg, bg);
      out['--on-accent on --accent'] = ratio('--on-accent', '--accent');
      return out;
    });
    expect(Object.entries(ratios).filter(([, r]) => r < 4.5)).toEqual([]);
  });
}
