# LLM prompts for building the APK on an Apple Silicon Mac

Paste these into a coding agent such as Claude Code on the Mac you want to build on.
Prompt 1 is usually all you need. They're based on a setup that worked on one Mac
(2026-11-26, v1.9); the prompts themselves haven't been tested on another machine.

They cover debug builds only. Signed public releases come from the GitHub release workflow,
which runs when you push a version tag, so a second Mac doesn't need the release key.

## Prompt 1: Set up and build

```text
Set up this Apple Silicon Mac to build the Android APK from https://github.com/electricburgers/tv-remote, then build it.

1. First, only inspect: check the CPU architecture, free disk space, Homebrew, JDK 21, the Android SDK, and whether the repo is already cloned. Tell me what's missing. If the repo has local changes, don't discard or overwrite them.
2. Read README.md, build-apk.sh and tv-remote-apk/app/build.gradle.kts. If they differ from this prompt, tell me before continuing.
3. If Homebrew is missing, give me the official install steps to run myself.
4. Ask before installing anything. Then install what's missing:
   brew install openjdk@21
   brew install --cask android-commandlinetools
   build-apk.sh expects:
   JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
   ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
   Use JDK 21. If Homebrew suggests installing temurin for the cask, it isn't needed when JAVA_HOME is set as above.
5. Show me that Android SDK licenses must be accepted, and get my explicit OK before running:
   sdkmanager --sdk_root="$ANDROID_HOME" --licenses
6. Run ./build-apk.sh. The first build needs internet access. Gradle should install any missing SDK packages once licenses are accepted (here: Build-Tools 36.0.0, Platform 36, Platform-Tools).
7. Don't change the project's Java, Gradle, plugin or dependency versions to get around an error. Show me the error and its cause first. Don't commit or push.
```

## Prompt 2: Keep the same signing key (before installing on your TV)

Each Mac normally has its own debug key. If the keys differ, an APK from the second Mac
**won't install over one from the first Mac**.

```text
I want debug APKs from this Mac to install over debug APKs built on my other Mac.

Explain how to copy ~/.android/debug.keystore from the original Mac to this one using AirDrop or an encrypted drive. I'll move the file myself.
- Before replacing a keystore on this Mac, back it up and ask me.
- Never print the key's contents, upload it, put it in the repo, or commit it.
- Afterward, rebuild with ./build-apk.sh.
- Verify with apksigner verify --print-certs from the Android build tools. Have me compare the certificate SHA-256 with the output for an APK built on the original Mac.
- Don't uninstall anything from my TV. This doesn't give me the Play Store or release signing key.
```

## Prompt 3: Verify the build

```text
Verify the APK build in this tv-remote repo without committing or pushing. Report each result, including anything skipped or failed.

1. Set JAVA_HOME and ANDROID_HOME to the values in build-apk.sh.
2. Run ./build-apk.sh.
3. In tv-remote-apk, run ./gradlew --no-daemon testDebugUnitTest.
4. Using aapt2 from the build tools, check that the APK in releases/ has package com.porter.tvremote and that versionName and versionCode match app/build.gradle.kts.
5. Check that assets/index.html inside the APK is byte-for-byte the same as the source file.
6. Run apksigner verify --print-certs and tell me whether it is debug-signed.
7. Run the web tests. They need Node.js (this project was tested with Node 26); ask before installing it. In web-tests run:
   npm ci
   npx playwright install chromium webkit
   npm test
8. Confirm with git status and git check-ignore that APKs in releases/ and tv-remote-apk/local.properties are ignored.
```

## Prompt 4: Fix a failed build

```text
My APK build failed on this Apple Silicon Mac. Diagnose it before changing anything.

Run ./build-apk.sh and find the first real error, not just the final Gradle summary. Check the CPU architecture, whether the terminal is running under Rosetta, the JDK version, both paths set in build-apk.sh, SDK licenses, installed SDK packages, disk space and network access.

Explain the cause with the relevant output, then propose the smallest fix. Ask before installing, deleting caches or changing project files. Don't upgrade or downgrade versions just to see whether it works, and don't print signing keys or passwords.

Error I saw:
<paste error here, with any secrets removed>
```
