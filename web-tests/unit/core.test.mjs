// Unit tests for the pure logic in <script id="core"> of the shared web remote.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const html = read('../../tv-remote-apk/app/src/main/assets/index.html');

function loadCore() {
  const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(src, 'index.html has no <script id="core"> block');
  const ctx = vm.createContext({});
  vm.runInContext(src, ctx);
  return ctx.TVCore;
}
// Objects from the vm realm have foreign prototypes; round-trip before deep compare.
const plain = v => JSON.parse(JSON.stringify(v));
const eq = (a, b) => assert.deepEqual(plain(a), b);
const C = () => loadCore();

test('prefs: defaults', () => {
  eq(C().migratePrefs(null), { theme: 'auto', left: false, nav: 'dpad', swipeSpeed: 'medium', haptics: true, dock: 'apps', dockSize: 4, dockLabels: true });
});
test('prefs: v1.8 swipe flag becomes nav mode, other choices survive', () => {
  const p = C().migratePrefs({ theme: 'light', left: true, swipe: true, haptics: false });
  assert.equal(p.nav, 'swipe');
  assert.equal(p.theme, 'light');
  assert.equal(p.left, true);
  assert.equal(p.haptics, false);
  assert.ok(!('swipe' in p));
});
test('prefs: an explicit nav mode beats the legacy flag', () => {
  assert.equal(C().migratePrefs({ swipe: true, nav: 'dpad' }).nav, 'dpad');
});
test('prefs: invalid values fall back to defaults', () => {
  const p = C().migratePrefs({ theme: 'neon', nav: 7, dock: 'sideways', dockSize: 99, swipeSpeed: 'x', dockLabels: 'yes' });
  eq(p, plain(C().migratePrefs({})));
});
test('prefs: junk storage is tolerated', () => {
  for (const junk of ['str', 5, [], true]) assert.equal(C().migratePrefs(junk).dock, 'apps');
});

test('theme: auto follows the system, explicit wins', () => {
  const { resolveTheme } = C();
  assert.equal(resolveTheme('auto', true), 'light');
  assert.equal(resolveTheme('auto', false), 'dark');
  assert.equal(resolveTheme('dark', true), 'dark');
  assert.equal(resolveTheme('light', false), 'light');
});

test('swipe: a tap is OK', () => {
  const s = C().createSwipe(34);
  s.start(100, 100);
  eq(s.move(103, 102), []);
  assert.equal(s.end(103, 102), 23);
});
test('swipe: each direction maps to its arrow key', () => {
  for (const [dx, dy, key] of [[0, -40, 19], [0, 40, 20], [-40, 0, 21], [40, 0, 22]]) {
    const s = C().createSwipe(34);
    s.start(100, 100);
    eq(s.move(100 + dx, 100 + dy), [key]);
    assert.equal(s.end(100 + dx, 100 + dy), null, 'a swipe must not also send OK');
  }
});
test('swipe: long travel emits one key per step and keeps the remainder', () => {
  const s = C().createSwipe(30);
  s.start(0, 0);
  eq(s.move(65, 0), [22, 22]);
  eq(s.move(89, 0), []);
  eq(s.move(90, 0), [22]);
});
test('swipe: one jumpy move event cannot flood the TV', () => {
  const s = C().createSwipe(30);
  s.start(0, 0);
  assert.equal(s.move(900, 0).length, 3);
  eq(s.move(900, 0), []);
});
test('swipe: dominant axis wins', () => {
  const s = C().createSwipe(30);
  s.start(0, 0);
  eq(s.move(40, 25), [22]);
});
test('swipe: held direction is exposed for hold-to-repeat', () => {
  const s = C().createSwipe(30);
  s.start(0, 0);
  assert.equal(s.held(), null);
  s.move(0, 35);
  assert.equal(s.held(), 20);
  s.end(0, 35);
  assert.equal(s.held(), null);
});
test('swipe: a wobble that returns to the start is not a tap', () => {
  const s = C().createSwipe(34);
  s.start(0, 0);
  s.move(25, 0);
  assert.equal(s.end(0, 0), null);
});
test('swipe: events without start do nothing', () => {
  const s = C().createSwipe(30);
  eq(s.move(100, 0), []);
  assert.equal(s.end(100, 0), null);
});
test('swipe: higher speed means a shorter step', () => {
  const { SWIPE_STEPS } = C();
  assert.ok(SWIPE_STEPS.fast < SWIPE_STEPS.medium && SWIPE_STEPS.medium < SWIPE_STEPS.slow);
});

test('moveItem: reorders without mutating, ignores out-of-range', () => {
  const { moveItem } = C();
  const list = ['a', 'b', 'c'];
  eq(moveItem(list, 0, 1), ['b', 'a', 'c']);
  eq(moveItem(list, 2, -1), ['a', 'c', 'b']);
  eq(moveItem(list, 0, -1), ['a', 'b', 'c']);
  eq(moveItem(list, 2, 1), ['a', 'b', 'c']);
  eq(list, ['a', 'b', 'c']);
});
test('splitDock: first N are pinned, the rest overflow', () => {
  const { splitDock } = C();
  eq(splitDock([1, 2, 3, 4, 5, 6], 4), { pinned: [1, 2, 3, 4], overflow: [5, 6] });
  eq(splitDock([1], 4), { pinned: [1], overflow: [] });
});

test('apps: validation messages', () => {
  const { validateApp } = C();
  assert.equal(validateApp({ label: 'Plex', target: 'com.plexapp.android' }), '');
  assert.match(validateApp({ label: '  ', target: 'youtube' }), /name/i);
  assert.match(validateApp({ label: 'X', target: 'a b;rm' }), /package/i);
});
test('apps: nothing stored gives defaults with unique ids', () => {
  const apps = C().loadApps(null);
  eq(apps.map(a => a.target), ['youtube', 'netflix', 'prime', 'disney', 'spotify', 'kodi']);
  assert.equal(new Set(apps.map(a => a.id)).size, apps.length);
});
test('apps: an emptied list stays empty', () => eq(C().loadApps([]), []));
test('apps: unsafe or broken entries are dropped, bad colours replaced', () => {
  const apps = C().loadApps([
    { id: 'a', label: 'Ok', target: 'com.ok.app', color: '#112233' },
    { id: 'b', label: 'Bad', target: 'x;reboot', color: '#112233' },
    null,
    { label: 'NoId', target: 'kodi', color: 'red;}' },
  ]);
  eq(apps.map(a => a.label), ['Ok', 'NoId']);
  assert.ok(apps[1].id);
  assert.match(apps[1].color, /^#[0-9a-f]{6}$/i);
});

test('typing: diff against what the TV already has', () => {
  const { typingDiff } = C();
  eq(typingDiff('', 'ab'), { del: 0, add: 'ab' });
  eq(typingDiff('abc', 'ab'), { del: 1, add: '' });
  eq(typingDiff('abc', 'axc'), { del: 2, add: 'xc' });
});
test('typing: non-ASCII is stripped', () => assert.equal(C().asciiOnly('café ☕!'), 'caf !'));

test('poll delay backs off and is capped', () => {
  const { pollDelay } = C();
  assert.equal(pollDelay(0), 5000);
  assert.equal(pollDelay(1), 10000);
  assert.equal(pollDelay(20), 60000);
});

test('both servers serve the same page', () => {
  assert.match(read('../../scripts/remote_server.py'), /tv-remote-apk.*assets/s);
});
