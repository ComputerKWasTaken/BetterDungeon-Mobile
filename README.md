# BetterDungeon Mobile

The Android WebView port of BetterDungeon for AI Dungeon, synced with the V2
desktop extension feature set where those features make sense on mobile.

## Installation

### Direct Download

1. Download the latest APK from Releases.
2. Open the APK on your Android device.
3. Allow installation from unknown sources if prompted.
4. Launch BetterDungeon Mobile.

### Build From Source

1. Clone this repository.
2. Open it in Android Studio.
3. Build and run on your device or emulator.

## Features

### Input Modes

- **Command Mode**: Send narrative commands to steer your story, including Subtle and OOC submodes.
- **Try Mode**: RNG-based action outcomes with configurable success odds, critical margins, and a touch-friendly success bar.

### Control And Navigation

- **Input History**: Cycle through recent inputs with a touch-friendly history bar, scoped per adventure.
- **Input Mode Colors**: Color-code the input box based on the active action mode.

### Writing And Formatting

- **Markdown Support**: BetterDungeon Markdown with shared V2 instruction presets, authors-note support, and auto-apply behavior.
- **Adventure Notes**: Local per-adventure notes inside Plot Components.
- **Text To Speech**: Uses Android's native TTS engine when available.

### Presets

- **Plot Presets**: Save and restore Plot Components.
- **Character Presets**: Save character dossiers and use the Ultrascripts AI module with Gemini to generate scenario prefill answers.

### Scenario Building

- **Trigger Highlighting**: Highlights active story card triggers in the context viewer.
- **Story Card Analytics**: Dashboard for card counts, overlaps, empty descriptors, and scenario health checks.

### Automations

- **Auto See**: Automatically sends background See actions on AI responses or turn intervals.
- **Auto Enable Scripts**: Re-enables AI Dungeon's scenario script toggle when the site turns it off unexpectedly.
- **Custom Dynamic**: Uses the shared V2 model-routing support where WebView request hooks can observe AI Dungeon generation requests.

### Ultrascripts

Ultrascripts is BetterDungeon's extension-to-script communication system. Mobile
now uses the canonical V2 module names and contracts:

- `ai`: Gemini-backed `status` and `query` operations.
- `widget`: Interactive script-rendered UI widgets.
- `webfetch`: Consent-gated HTTP fetch/search support.
- `clock`: Local time, timezone, and formatting helpers.
- `geolocation`: Android/WebView geolocation permission and position helpers.
- `weather`: Open-Meteo current weather and forecasts.
- `network`: Online and connection-quality hints.
- `system`: Device, browser, screen, locale, and power hints.
- `sdk`: Safe BetterDungeon configuration snapshots for scripts.

Hotkeys and Story Card Modal Dock are intentionally not shipped on mobile.

## Mobile-Specific UI

- **Settings Gear**: A BetterDungeon settings button is injected directly into the AI Dungeon UI.
- **Scrollable Mode Menu**: Command and Try mode controls adapt the input mode menu for narrow touch screens.
- **Bottom-Sheet Popup**: Settings run in a secondary WebView connected to the main AI Dungeon WebView.

## How It Works

BetterDungeon Mobile wraps AI Dungeon in an Android WebView and injects the same
JavaScript and CSS used by the desktop extension. A WebView polyfill maps
Chrome extension APIs to Android equivalents backed by `BetterDungeonBridge`
and SharedPreferences. Mobile also emulates the extension background message
contracts used by Ultrascripts modules.

## Support

- Found a bug? Report it on GitHub.
- Have an idea? Submit a feature request.
- Contact on Discord: `@computerK`
