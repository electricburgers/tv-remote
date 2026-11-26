# Changelog

## 1.8 (versionCode 9)

### Web remote (rewritten)
- **Fixed:** double-tapping quickly no longer zooms the page (`touch-action: manipulation`; pinch-zoom still works).
- **Light / dark / auto theme** with a header toggle; follows the system setting by default and is applied before first paint.
- **Customizable app buttons:** long-press a button (or tap *Edit*) to rename, recolor, reorder, delete or add apps by package name. Presets included, plus packages seen in the foreground on your TV. Stored in the browser; *Reset app buttons* restores the defaults (YouTube, Netflix, Prime, Disney+, Spotify, Kodi).
- **Hold to repeat** on D-pad arrows, volume, channel, rewind and fast-forward.
- **Swipe pad** mode (settings): the D-pad ring becomes a trackpad. Swipe for arrows, tap for OK.
- **Live typing:** characters are sent as you type, Backspace is forwarded, Enter submits on the TV.
- **Left-handed layout**, optional haptic feedback, reconnect banner with Retry, Add-to-Home-Screen metadata.
- Fluid layout, 44px+ touch targets, ARIA labels, `prefers-reduced-motion` respected.
- Polling pauses while the tab is hidden, never overlaps, and backs off while the server is unreachable. One delegated event handler replaces ~30 inline handlers.
- **About** (remote settings) shows the version and build date/time.

### Server
- `/api/state` reads screen state and foreground app in a single ADB shell call (was two) and caches the result for 2 s, so several open pages cost one `dumpsys` instead of one each. Any key/launch action invalidates the cache.
- `index.html` and the TV model name are read once instead of on every request.

## 1.7 (versionCode 8)
- Opened on a phone, the app now says it belongs on the TV, and the screen scrolls on small displays.
- The HTTP port field has −/+ buttons so it can be changed with a TV remote.
- Fixes: Stop no longer freezes the app while the USB debugging prompt is open; a server already starting in the background shows as running and keeps its port.

Earlier releases: see `fastlane/metadata/android/en-US/changelogs/`.
