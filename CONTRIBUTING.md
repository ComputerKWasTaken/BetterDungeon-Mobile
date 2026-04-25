# Contributing to BetterDungeon Mobile

Developer documentation for contributors and maintainers.

---

## Development Guide

### Getting Started

#### Prerequisites
- [Android Studio](https://developer.android.com/studio) (latest stable)
- Android SDK with API level 36
- An Android device or emulator running Android 8.1+ (API 27+)
- Git
- Basic knowledge of Kotlin and Android development

### Development Workflow

#### Setup
1. Fork/clone this repository
2. Open the project in Android Studio
3. Let Gradle sync and download dependencies
4. Connect a device or start an emulator
5. Click **Run** (or `Shift + F10`) to build and deploy
6. The app will open AI Dungeon with BetterDungeon injected automatically
7. Make your changes, rebuild, and test on [AI Dungeon](https://play.aidungeon.com)

> **Tip:** Use Android Studio's Logcat with the tag `BetterDungeon` or `BDWebView` to see extension logs from the WebView.

---

## Architecture & Structure

### Project Overview

```
BetterDungeon-Mobile/
├── app/
│   ├── build.gradle.kts              # App-level dependencies and SDK config
│   ├── src/main/
│   │   ├── AndroidManifest.xml        # App permissions and activity config
│   │   ├── java/com/computerk/betterdungeon/
│   │   │   ├── MainActivity.kt        # WebView host and popup panel management
│   │   │   ├── InjectionEngine.kt     # CSS/JS asset injection pipeline
│   │   │   └── BetterDungeonBridge.kt # @JavascriptInterface for JS ↔ Kotlin
│   │   ├── assets/betterdungeon/      # Extension JS/CSS (shared with browser ext)
│   │   │   ├── main.js                # Core orchestrator
│   │   │   ├── core/                  # Feature manager and theme variables
│   │   │   ├── features/             # Self-contained feature modules
│   │   │   │   └── mobile/           # Mobile-specific features
│   │   │   ├── services/             # AI Dungeon API and scanning services
│   │   │   ├── utils/                # DOM helpers, storage, and WebView polyfill
│   │   │   ├── fonts/                # Bundled fonts (IBM Plex Sans, Roboto Mono, Lucide)
│   │   │   ├── icons/                # Extension icons
│   │   │   ├── popup.html/js/css     # Settings popup interface
│   │   │   └── styles.css            # Feature styles
│   │   └── res/                       # Android resources (layouts, drawables, themes)
├── build.gradle.kts                   # Top-level Gradle config
├── settings.gradle.kts                # Project settings
└── gradle/                            # Gradle wrapper
```

### Architecture Patterns

BetterDungeon Mobile uses a layered architecture that bridges Android native code with the browser extension's JavaScript.

- **MainActivity.kt** — Hosts two WebViews: one for AI Dungeon (main) and one for the popup/settings panel. Manages edge-to-edge rendering, back navigation, and popup visibility
- **InjectionEngine.kt** — Reads and concatenates all CSS/JS from the `assets/betterdungeon/` directory. Injects them into the WebView on every `onPageFinished` for `aidungeon.com` pages. Handles font embedding as base64 data URIs to work around WebView security restrictions
- **BetterDungeonBridge.kt** — Exposes `@JavascriptInterface` methods as `BetterDungeonBridge` in JS. Routes `chrome.storage` calls to SharedPreferences, handles cross-WebView messaging between the main and popup WebViews, and provides asset data URI conversion
- **webview-polyfill.js** — Replaces `chrome.runtime`, `chrome.storage`, and `chrome.tabs` APIs with Android-compatible equivalents so the extension's JS runs without modification
- **features/mobile/** — Mobile-specific modules: `mobile_settings_layer.js` injects a settings gear into AI Dungeon's UI, and `mobile_design_layer.js` makes the input mode menu scrollable on narrow screens

### Injection Pipeline

The injection follows the same load order as the browser extension's `manifest.json`:

1. **CSS** — Theme variables → feature styles → Lucide icon font (with fonts embedded as base64)
2. **JS** — WebView polyfill (first) → utilities → services → feature manager → features → mobile features → main.js (last)

Each JS file is wrapped in a `try/catch` block so a failure in one feature doesn't break the rest.

---

## Version History

### Changelog

### v1.1
- Fixed Story Card Dashboard button for AI Dungeon's reworked Story Card menu
- Updated DOM selectors: Filters button removed, "Add Story Card" renamed to "Create Story Card"
- Restyled Dashboard button to match the new Create Story Card button design
- Updated Story Card Scanner to recognize the new "Create Story Card" button

### v1.0
- Initial release
- Full port of all BetterDungeon browser extension features to Android WebView
- Native Kotlin host with JavaScript bridge (`BetterDungeonBridge`)
- WebView polyfill mapping Chrome extension APIs to Android equivalents
- Mobile-specific settings gear injection (home and adventure pages)
- Scrollable input mode menu with gradient fade affordance
- SharedPreferences-backed storage for all extension settings
- Edge-to-edge rendering with system bar inset handling
- Cross-WebView messaging between main and popup panels
- Base64 font embedding for WebView security compatibility

---

## Feature Development

### Adding New Features

Features shared with the browser extension go in `assets/betterdungeon/features/`. Mobile-specific features go in `assets/betterdungeon/features/mobile/`.

#### Shared Features

1. Port or copy the feature file from the [BetterDungeon](https://github.com/ComputerKWasTaken/BetterDungeon) repo into `app/src/main/assets/betterdungeon/features/`

2. Register it in `InjectionEngine.kt` by adding to the `JS_FILES` list:
```kotlin
private val JS_FILES = listOf(
    // ... existing files ...
    "features/my_new_feature.js",
    // ... main.js must remain last ...
    "main.js"
)
```

3. If the feature has CSS, add it to the `CSS_FILES` list (or include it in `styles.css`)

#### Mobile-Specific Features

1. Create a new file in `app/src/main/assets/betterdungeon/features/mobile/`:

```javascript
// ═══ mobile_my_feature.js ═══
// Description of what this mobile feature does.

(function() {
    'use strict';

    // Your mobile-specific logic here.
    // Use window.BetterDungeonBridge for native Android calls.
    // Use window.betterDungeonInstance for feature manager access.

    console.log('[BetterDungeon] Mobile My Feature initialized');
})();
```

2. Register it in `InjectionEngine.kt`:
```kotlin
private val JS_FILES = listOf(
    // ... existing files ...
    "features/mobile/mobile_my_feature.js",
    "main.js"  // Must remain last
)
```

### Adding Native Bridge Methods

If your feature needs native Android functionality:

1. Add a `@JavascriptInterface` method in `BetterDungeonBridge.kt`:
```kotlin
@JavascriptInterface
fun myNativeMethod(param: String): String {
    // Native Android logic
    return "result"
}
```

2. Call it from JavaScript:
```javascript
const result = window.BetterDungeonBridge.myNativeMethod("value");
```

---

## Support

- [Found a bug?](../../issues) Report it on GitHub
- [Feature idea?](../../issues/new) I'd love to hear it
- Need help? Check the [Contributing Guide](CONTRIBUTING.md) for technical details
- Contact me on Discord: `@computerK`

---

**Made with ❤️ for the AI Dungeon community**
