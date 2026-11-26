// A fake TV server: Playwright serves the real page and records every API call.
import { readFileSync } from 'node:fs';
import { test as base, expect } from '@playwright/test';

const PAGE = new URL('../../tv-remote-apk/app/src/main/assets/index.html', import.meta.url);
export const URL_ = 'http://tv.test/';

export const test = base.extend({
  tv: async ({ page }, use) => {
    const tv = {
      calls: [], online: true,
      posts() { return this.calls.filter(c => c.method === 'POST').map(c => c.path); },
      keys() { return this.posts().filter(p => p.startsWith('/api/key/')).map(p => +p.split('/').pop()); },
      reset() { this.calls.length = 0; },
      async open({ storage } = {}) {
        if (storage) await page.addInitScript(s => {
          if (sessionStorage.getItem('seeded')) return;
          for (const [k, v] of Object.entries(s)) localStorage.setItem(k, JSON.stringify(v));
          sessionStorage.setItem('seeded', '1');
        }, storage);
        await page.goto(URL_);
      },
    };
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('http://tv.test/**', async route => {
      const req = route.request();
      const path = new URL(req.url()).pathname;
      if (path === '/') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: readFileSync(PAGE, 'utf8') });
      tv.calls.push({ method: req.method(), path, body: req.postData() });
      if (!tv.online) return route.abort();
      const json = path === '/api/state' ? { ok: true, screen: 'ON', app: 'com.netflix.ninja' }
        : path === '/api/config' ? { name: 'Living Room', host: '192.168.1.20' }
        : path === '/api/adb' ? { connected: true }
        : { ok: true };
      return route.fulfill({ json });
    });
    await use(tv);
    expect(errors, 'uncaught page errors').toEqual([]);
  },
});
export { expect };
