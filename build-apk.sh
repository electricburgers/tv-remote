#!/usr/bin/env bash
# Build a sideloadable (debug-signed) APK from the current working tree.
# Output: releases/tv-remote-v<versionName>-debug.apk (gitignored)
# Web app source: tv-remote-apk/app/src/main/assets/index.html
set -euo pipefail
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
cd "$(dirname "$0")/tv-remote-apk"
echo "sdk.dir=$ANDROID_HOME" > local.properties
./gradlew --no-daemon -q assembleDebug
version=$(sed -n 's/.*versionName = "\(.*\)"/\1/p' app/build.gradle.kts)
mkdir -p ../releases
out="$(cd ../releases && pwd)/tv-remote-v$version-debug.apk"
cp app/build/outputs/apk/debug/app-debug.apk "$out"
echo "Built: $out"
