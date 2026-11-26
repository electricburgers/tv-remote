#!/usr/bin/env python3
"""Google TV Remote — web GUI server.

Serves an HTML remote control at http://localhost:5052
and handles ADB commands via REST API.
"""
import sys, os, threading, webbrowser, time, logging
from flask import Flask, jsonify, request, send_from_directory

logging.getLogger('werkzeug').setLevel(logging.ERROR)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from adb_client import TVClient, TV_HOST, TV_PORT, TV_NAME, require_config

# One web remote for both servers: the page bundled into the Android app.
WEB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..',
                       'tv-remote-apk', 'app', 'src', 'main', 'assets')
app = Flask(__name__, static_folder=None)

_tv: TVClient | None = None
_lock = threading.Lock()

# /api/state is polled by every open page. One ADB read is shared by all of them
# within the TTL, so TV traffic per interval is O(1) in the number of pages, not O(n).
STATE_TTL = 2.0  # seconds
_state_cache: tuple[float, dict, int] | None = None  # (expires_at, body, status)

APPS = {
    'youtube':  'com.google.android.youtube.tv/com.google.android.apps.youtube.tv.activity.ShellActivity',
    'netflix':  'com.netflix.ninja/.MainActivity',
    'prime':    'com.amazon.amazonvideo.livingroom/.MainActivity',
    'disney':   'com.disney.disneyplus/.MainActivity',
    'settings': 'com.android.settings/.Settings',
    'spotify':  'com.spotify.tv.android/.SpotifyTVActivity',
    'kodi':     'org.xbmc.kodi/.Splash',
}


def get_tv() -> TVClient:
    global _tv
    if _tv is None:
        _tv = TVClient()
        _tv.connect()
    return _tv


def drop_tv():
    global _tv
    try:
        if _tv:
            _tv.close()
    except Exception:
        pass
    _tv = None


def run_action(action):
    """Run action(tv) under the ADB lock and return the API response."""
    global _state_cache
    with _lock:
        # The action probably changes what /api/state would report.  Cleared
        # before it runs, so polls arriving meanwhile wait for a fresh read.
        _state_cache = None
        try:
            action(get_tv())
            return jsonify({'ok': True})
        except Exception as e:
            drop_tv()
            return jsonify({'ok': False, 'error': str(e)}), 500


def fresh_state():
    cached = _state_cache  # read once: another thread may clear the global
    if cached and time.monotonic() < cached[0]:
        return cached[1], cached[2]
    return None


def read_state():
    """Return (body, status) for /api/state, reading the TV at most once per TTL."""
    global _state_cache
    hit = fresh_state()  # fast path: no waiting on the ADB lock
    if hit:
        return hit
    with _lock:
        hit = fresh_state()  # another poll may have filled it while we waited
        if hit:
            return hit
        try:
            tv = get_tv()
            body, status = {'ok': True, 'screen': tv.screen_state(), 'app': tv.current_app()}, 200
        except Exception as e:
            # Cached too: otherwise, with the TV offline, each queued poll would
            # sit through its own connect timeouts one after another.
            body, status = {'ok': False, 'error': str(e)}, 500
        _state_cache = (time.monotonic() + STATE_TTL, body, status)
        return body, status


@app.route('/api/config')
def config():
    return jsonify({'name': TV_NAME, 'host': TV_HOST, 'port': TV_PORT})


@app.route('/')
def index():
    return send_from_directory(WEB_DIR, 'index.html')


@app.route('/api/key/<int:code>', methods=['POST'])
def key(code):
    return run_action(lambda tv: tv.key(code))


@app.route('/api/launch/<name>', methods=['POST'])
def launch(name):
    def action(tv):
        if name in APPS:
            tv.launch_app(APPS[name])
        elif name == 'home':
            tv.go_home()
        else:
            tv.shell(f'monkey -p {name} -c android.intent.category.LAUNCHER 1')
    return run_action(action)


@app.route('/api/assistant', methods=['POST'])
def assistant():
    return run_action(lambda tv: tv.launch_assistant())


@app.route('/api/text', methods=['POST'])
def send_text():
    data = request.get_json(silent=True) or {}
    text = data.get('text', '')
    if not text:
        return jsonify({'ok': False, 'error': 'No text provided'}), 400
    return run_action(lambda tv: tv.send_text(text))


@app.route('/api/state')
def state():
    body, status = read_state()
    return jsonify(body), status


PORT = 5052


if __name__ == '__main__':
    require_config()

    import socket as _socket
    try:
        _s = _socket.socket(_socket.AF_INET, _socket.SOCK_DGRAM)
        _s.connect(('8.8.8.8', 80))
        _lan_ip = _s.getsockname()[0]
        _s.close()
    except Exception:
        _lan_ip = 'localhost'
    print(f'TV Remote GUI → http://localhost:{PORT}')
    print(f'On your phone  → http://{_lan_ip}:{PORT}')
    with _lock:
        try:
            get_tv()
            print(f'Connected to {TV_HOST}:{TV_PORT}')
        except Exception as e:
            print(f'Warning: {e} — will retry on first button press')

    threading.Thread(
        target=lambda: (time.sleep(1.2), webbrowser.open(f'http://localhost:{PORT}')),
        daemon=True
    ).start()

    app.run(host='0.0.0.0', port=PORT, debug=False, threaded=True)
