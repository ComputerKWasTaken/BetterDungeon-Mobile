# BetterDungeon Mobile

<div align="center">

**BetterDungeon, in your pocket.**

The Android WebView port of BetterDungeon for AI Dungeon, bringing the features that make sense on a touch screen together with a few mobile-specific improvements.

[![Version](https://img.shields.io/badge/version-2.0.0-7c3aed?style=for-the-badge)](app/build.gradle.kts)
[![Android](https://img.shields.io/badge/Android-API_27%2B-3DDC84?style=for-the-badge&logo=android&logoColor=white)](https://developer.android.com/)
[![License](https://img.shields.io/github/license/ComputerKWasTaken/BetterDungeon?style=for-the-badge)](https://github.com/ComputerKWasTaken/BetterDungeon/blob/main/LICENSE)

</div>

> This repository is for developing BetterDungeon Mobile. It is not the public release repository.

## Important: where to get the APK

The official BetterDungeon Android APK is hosted on the **primary BetterDungeon repository**, not this Mobile development repository. This keeps downloads simple and preserves the single release location that BetterDungeon users are already familiar with.

**[Download BetterDungeon Mobile from the primary repository's Releases page.](https://github.com/ComputerKWasTaken/BetterDungeon/releases)**

Please do not direct regular users to this repository for APK downloads. Come here when you want to inspect the Android implementation, contribute code, or build the app yourself.

## What is BetterDungeon Mobile?

Hey everyone, it's computerK here. BetterDungeon Mobile is the Android side of the BetterDungeon ecosystem: an Android WebView wrapper around AI Dungeon with BetterDungeon's JavaScript and CSS features injected directly into the experience.

The goal is not to force every desktop feature onto a phone. The goal is to bring the good stuff over, make it feel natural with touch controls, and add the Android bridge work needed to make extension-style features function inside a native app.

The current release is **BetterDungeon V2**, with shared feature parity wherever mobile can support it. Some desktop-only tools, such as Hotkeys and the Story Card Modal Dock, are intentionally not included on mobile.

## Getting started

### Download the official release

1. Visit the [Releases page on the primary BetterDungeon repository](https://github.com/ComputerKWasTaken/BetterDungeon/releases).
2. Download the latest Android `.apk` file.
3. Open the APK on your Android device.
4. Allow installation from unknown sources if Android asks.
5. Launch BetterDungeon Mobile and start playing.

### Build it yourself

1. Clone this repository.
2. Open it in Android Studio.
3. Let Gradle sync the project.
4. Connect an Android device or start an emulator.
5. Run the `app` configuration.

You can also build from a terminal with the Gradle wrapper:

```bash
# macOS/Linux
./gradlew assembleDebug

# Windows
gradlew.bat assembleDebug
```

The debug APK will be placed under `app/build/outputs/apk/debug/`. Self-built APKs are for development and testing; official public releases remain on the primary repository.

## The mobile feature lineup

### Better writing on a touch screen

- **Markdown** — Shared V2 Markdown instruction presets with authors-note support and automatic application.
- **Command Mode** — Send narrative commands with Subtle and OOC sub-modes.
- **Try Mode** — Run configurable RNG-based action checks with touch-friendly controls.
- **Adventure Notes** — Keep notes per adventure inside Plot Components.
- **Text to Speech** — Narrate story text using Android's native text-to-speech engine when available.

### Control and navigation

- **Input History** — Cycle through recent inputs with a touch-friendly history bar scoped to each adventure.
- **Input Mode Colors** — Color-code the input area based on the active action mode.
- **Mobile Settings Gear** — Open BetterDungeon settings directly from the AI Dungeon interface.
- **Scrollable Mode Menu** — Use Command and Try controls comfortably on narrow screens.
- **Bottom-Sheet Popup** — Access settings in a secondary WebView designed for mobile.

### Scenario tools and automation

- **Plot Presets** — Save and restore Plot Components.
- **Character Presets** — Save character dossiers and use Gemini through the Ultrascripts AI module to generate scenario prefill answers.
- **Trigger Highlighting** — See active Story Card triggers in the context viewer.
- **Story Card Analytics** — Review card counts, overlaps, empty descriptors, and scenario health information.
- **Auto See** — Send background See actions on AI responses or configured turn intervals.
- **Auto Enable Scripts** — Re-enable AI Dungeon's scenario script toggle when it turns off unexpectedly.
- **Custom Dynamic** — Use the shared V2 model-routing system when WebView request hooks can observe AI Dungeon generation requests.

## Ultrascripts on Android

Ultrascripts is BetterDungeon's extension-to-script communication system. Mobile implements the canonical V2 module names and contracts through the Android WebView bridge:

| Module | What it enables |
| --- | --- |
| `ai` | Gemini-backed status and query operations |
| `widget` | Interactive script-rendered UI widgets |
| `webfetch` | Consent-gated HTTP fetch and search support |
| `clock` | Local time, timezone, and formatting helpers |
| `geolocation` | Opt-in Android/WebView location access |
| `weather` | Current weather and forecast data |
| `network` | Online and connection-quality hints |
| `system` | Device, browser, screen, locale, and power information |
| `sdk` | Safe BetterDungeon configuration snapshots |

Permission-sensitive modules remain opt-in. The app requests location access only when the Ultrascripts Geolocation flow needs it.

## How it works

BetterDungeon Mobile uses two connected WebViews:

- The main WebView loads AI Dungeon.
- A secondary WebView hosts the BetterDungeon settings panel.

The app injects the shared BetterDungeon JavaScript and CSS into the AI Dungeon WebView. A WebView polyfill maps extension APIs such as `chrome.storage`, `chrome.runtime`, and `chrome.tabs` to Android-compatible behavior backed by `BetterDungeonBridge` and SharedPreferences.

This lets the mobile build share a large portion of BetterDungeon's feature code while still supporting Android-specific UI and native capabilities.

## Data and privacy

BetterDungeon Mobile:

- Loads AI Dungeon in a WebView and needs Internet access for AI Dungeon and enabled network features.
- Requests location permission only for the opt-in Geolocation flow.
- Stores settings, presets, notes, WebFetch consent decisions, and Gemini API keys locally on the device.
- Does not expose Gemini API keys through the Ultrascripts SDK/config surface.
- Opens non-AI-Dungeon links in the system browser.
- Disables Android app-data backup for release builds so local secrets and settings are not copied through cloud backup or device transfer by default.

You are responsible for any API keys you configure and for reviewing the permissions of scripts you run.

## Contributing

This is the place to contribute to the Android implementation, improve the native bridge, polish mobile-specific UI, or update the shared feature injection pipeline.

If you are looking for the public extension or the official APK releases, use the [primary BetterDungeon repository](https://github.com/ComputerKWasTaken/BetterDungeon) instead. For development details, read [CONTRIBUTING.md](CONTRIBUTING.md).

## Support

- Found a mobile bug? [Open an issue](../../issues/new).
- Have a feature idea? [Open a feature request](../../issues/new).
- Looking for an APK? Visit the [primary BetterDungeon Releases page](https://github.com/ComputerKWasTaken/BetterDungeon/releases).
- Want to talk about the project? Find me on Discord at `@computerK`.

Much love.

— computerK
