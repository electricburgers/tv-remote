#!/usr/bin/env bash
# Build a sideloadable (debug-signed) APK from the current working tree.
# Web app source: tv-remote-apk/app/src/main/assets/index.html
set -euo pipefail
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
cd "$(dirname "$0")/tv-remote-apk"
echo "sdk.dir=$ANDROID_HOME" > local.properties
./gradlew --no-daemon -q assembleDebug
out="$(cd .. && pwd)/tv-remote-debug.apk"
cp app/build/outputs/apk/debug/app-debug.apk "$out"
echo "Built: $out"
