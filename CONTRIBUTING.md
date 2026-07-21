# Contributing to BetterDungeon Mobile

Hey! Thanks for being interested in the Android side of BetterDungeon.

This repository is the **development home** for BetterDungeon Mobile. It contains the native Android host, the WebView bridge, the injection pipeline, and the mobile-specific UI layers. It is also where contributors can build and test their own APKs.

The official public APK releases are hosted on the [primary BetterDungeon repository](https://github.com/ComputerKWasTaken/BetterDungeon/releases). Please keep that distinction in mind when opening documentation, issues, or pull requests: this repository is for development, not public release distribution.

## Before you start

You will need:

- [Android Studio](https://developer.android.com/studio)
- Android SDK and build tools for API level 36
- An Android device or emulator running Android 8.1 or newer (API 27+)
- Git
- A basic understanding of Kotlin, Android development, JavaScript, and WebViews
- An AI Dungeon account for testing the injected experience

The project uses Gradle through the checked-in wrapper, so you do not need to install Gradle separately.

## Run the project locally

1. Fork and clone this repository.
2. Open the project in Android Studio.
3. Let Android Studio sync Gradle and download dependencies.
4. Connect a device or start an emulator running Android 8.1+.
5. Run the `app` configuration.
6. Open AI Dungeon and test the feature in a real adventure.

From a terminal, the common commands are:

```bash
# Windows
gradlew.bat assembleDebug
gradlew.bat installDebug

# macOS/Linux
./gradlew assembleDebug
./gradlew installDebug
```

Debug APKs are written to `app/build/outputs/apk/debug/`. Do not upload development APKs as official releases. Public APK downloads belong on the primary BetterDungeon repository.

For runtime debugging, use Android Studio's Logcat and filter for `BetterDungeon` or `BDWebView`.

## Project structure

```text
BetterDungeon-Mobile/
├── app/
│   ├── build.gradle.kts              App dependencies, SDK, and version metadata
│   └── src/main/
│       ├── AndroidManifest.xml       Permissions and activity configuration
│       ├── java/com/computerk/betterdungeon/
│       │   ├── MainActivity.kt       WebView host and popup management
│       │   ├── InjectionEngine.kt    JavaScript/CSS asset injection pipeline
│       │   └── BetterDungeonBridge.kt JS-to-Kotlin bridge
│       ├── assets/betterdungeon/     Shared extension assets
│       │   ├── main.js               Shared feature orchestrator
│       │   ├── core/                 Feature manager and theme variables
│       │   ├── features/             Shared feature modules
│       │   │   └── mobile/           Mobile-specific feature layers
│       │   ├── services/             AI Dungeon and Ultrascripts services
│       │   ├── utils/                Storage, DOM, and WebView helpers
│       │   ├── popup.html/js/css      Settings interface
│       │   └── styles.css            Feature styles
│       └── res/                      Android resources and themes
├── build.gradle.kts                  Top-level Gradle configuration
├── settings.gradle.kts               Project settings
└── gradle/                            Gradle wrapper
```

## Architecture

BetterDungeon Mobile is a layered bridge between native Android and the shared BetterDungeon JavaScript:

- **`MainActivity.kt`** hosts the main AI Dungeon WebView and the settings WebView. It also manages back navigation, popup visibility, and edge-to-edge behavior.
- **`InjectionEngine.kt`** reads and injects the BetterDungeon CSS and JavaScript assets into AI Dungeon after page loads. It also handles font embedding for WebView compatibility.
- **`BetterDungeonBridge.kt`** exposes the `BetterDungeonBridge` JavaScript interface, routes storage through SharedPreferences, and handles communication between the two WebViews.
- **`webview-polyfill.js`** provides Android-compatible versions of extension APIs such as `chrome.runtime`, `chrome.storage`, and `chrome.tabs`.
- **`features/mobile/`** contains mobile-only behavior, including the settings gear and touch-friendly mode menu.

The injection order mirrors the browser extension where practical:

1. Theme variables, feature styles, and icon fonts.
2. The WebView polyfill.
3. Utilities and shared services.
4. Feature manager and shared features.
5. Mobile-specific feature layers.
6. `main.js` last.

Each injected JavaScript file is isolated so one feature failing does not prevent the rest of the app from loading.

## Adding or updating shared features

Shared features should remain compatible with the primary BetterDungeon repository whenever possible.

1. Make or verify the feature change in the primary BetterDungeon repository.
2. Copy the relevant shared asset into `app/src/main/assets/betterdungeon/`.
3. Register the file in the appropriate list in `InjectionEngine.kt`.
4. Preserve the expected load order, with `main.js` last.
5. Test the feature on Android and on the browser extension when the change affects shared behavior.
6. Update the documentation or examples if the public behavior or Ultrascripts contract changes.

The mobile copy of shared assets is intentionally explicit. If a file is added to the browser extension, it still needs to be included and registered here before the Android build can use it.

## Adding mobile-specific features

Mobile-only features belong in `app/src/main/assets/betterdungeon/features/mobile/`.

1. Create a focused JavaScript file using the existing mobile feature conventions.
2. Use `window.BetterDungeonBridge` for native Android calls.
3. Use the existing feature manager or shared state interfaces where appropriate.
4. Register the file in `InjectionEngine.kt` after shared features and before `main.js`.
5. Make sure the feature handles repeated page loads without duplicating listeners or UI.
6. Test on both a small phone-sized viewport and a larger Android device or emulator.

Example shape:

```javascript
(function () {
  'use strict';

  function init() {
    // Set up mobile-specific UI or bridge behavior.
  }

  init();
})();
```

## Adding native bridge methods

If a feature needs Android functionality:

1. Add a narrowly scoped `@JavascriptInterface` method to `BetterDungeonBridge.kt`.
2. Validate all JavaScript-provided input on the Kotlin side.
3. Return a predictable result or error representation.
4. Call it from JavaScript through `window.BetterDungeonBridge`.
5. Document the new bridge contract and test permission-denied behavior.

Never expose API keys, private data, or broad native capabilities unnecessarily. Keep bridge methods small and specific to the feature that needs them.

## Release and signing rules

This repository supports release development, but it is not the public release location.

- Official APK downloads and GitHub releases belong on the primary BetterDungeon repository.
- Keep release keystores, passwords, signing files, and signing configuration outside the repository.
- Confirm `versionCode` and `versionName` in `app/build.gradle.kts` before preparing a release build.
- Build signed APKs through Android Studio's **Generate Signed Bundle / APK** flow or an approved local release process.
- Smoke test signed builds on a physical device.
- Do not commit private signing material or upload a release APK here just because it was built locally.

The public download path should remain simple: users go to the main BetterDungeon repository, and contributors come here to develop.

## Testing checklist

Before opening a pull request:

- [ ] The app builds successfully with the Gradle wrapper.
- [ ] The app launches on an Android 8.1+ device or emulator.
- [ ] AI Dungeon loads correctly in the main WebView.
- [ ] The settings popup opens and communicates with the main WebView.
- [ ] The feature works after a fresh page load.
- [ ] The feature does not duplicate listeners or UI after navigation or reinjection.
- [ ] Location and other permission-gated flows handle denial cleanly.
- [ ] Shared storage and WebView bridge behavior still work.
- [ ] No API keys, signing files, tokens, personal data, or generated secrets are committed.
- [ ] Shared feature changes are checked against the primary browser repository where relevant.
- [ ] Documentation is updated for public behavior or bridge changes.

## Pull requests

A useful pull request should explain:

- What changed and why.
- Whether the change is native Android, shared JavaScript, or mobile-specific JavaScript.
- Which Android versions and device sizes you tested.
- Whether the change affects permissions, storage, WebView behavior, or the bridge contract.
- Whether the corresponding browser-extension implementation also needs an update.
- Any screenshots or recordings that make UI changes easier to review.

Please keep pull requests focused. A small, well-tested Android change is much easier to review than a large cleanup mixed with unrelated feature work.

## Bug reports and feature ideas

Before opening an issue, check for an existing report. For mobile bugs, include:

- Device model and Android version.
- BetterDungeon Mobile version or commit.
- Whether the APK was downloaded from the primary repository or built locally.
- The AI Dungeon page or feature where the issue occurred.
- Reproduction steps.
- Relevant Logcat output, with API keys and private information removed.

Feature ideas are welcome. Explain the problem you are trying to solve and whether you think it belongs in the shared BetterDungeon layer or the Android-specific layer.

## A final note

BetterDungeon Mobile exists to make the desktop project's ideas work properly on a phone, not to become a confusing second release channel. Thanks for helping improve the Android experience while keeping the public download path straightforward for everyone.

Much love.

— computerK
