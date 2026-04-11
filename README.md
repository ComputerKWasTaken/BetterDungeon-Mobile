# ![BetterDungeon Icon](app/src/main/assets/betterdungeon/icons/icon16.png) BetterDungeon Mobile

The Android companion app for [BetterDungeon](https://github.com/ComputerKWasTaken/BetterDungeon) — bringing the full extension experience to AI Dungeon on your phone.

## Installation

### Direct Download (Recommended)

1. Download the latest APK from [Releases](../../releases)
2. Open the APK on your Android device
3. Allow installation from unknown sources if prompted
4. You're in!

> **Note:** Requires Android 8.1 (Oreo) or higher.

### Build from Source

For developers or if you prefer to build it yourself:

1. Clone this repository
2. Open in [Android Studio](https://developer.android.com/studio)
3. Build and run on your device or emulator
4. You're in!

## Features

All the features you know from the browser extension, optimized for mobile.

### 🎮 Input Modes

- **Command Mode** — Send narrative commands to steer your story. Subtle and OOC submodes included!
- **Try Mode** — RNG-based action outcomes with dice rolling mechanics. Configurable critical hit/fail chance, adjustable success odds, and a visual success bar.

### 🧭 Control & Navigation

- **Input History** — Cycle through your previous inputs with a touch-friendly history bar. Remembers up to 50 recent actions and their respective input modes.
- **Input Mode Colors** — Color-coded input box so you always know what mode you're in. Fully customizable colors for each mode.

### ✨ Writing & Formatting

- **Markdown Support** — Bold, italic, underline, whisper text, scene breaks, lists, and more. One-click AI instruction application with an auto-apply option.
- **Adventure Notes** — Embedded Plot Components notes card that saves per adventure. Track plot points, character details, or session notes without AI interference.

### 🔧 Scenario Building

- **Trigger Highlighting** — Story card triggers get highlighted in the context viewer. Hover to jump to the card. Also suggests proper nouns that might deserve their own story cards.
- **Story Card Analytics Dashboard** — Card statistics, trigger overlaps, coverage analysis, and potential issues for scenario creators.
- **Story Card Modal Dock** — Docks the story card modal to the side, allowing you to scroll through your story while editing Story Cards.
- **BetterScripts** — A communication layer between the app and AI Dungeon scripts for dynamic UI widgets like HP bars, stats, and game state displays.

### ⚡ Automations

- **Auto See** — Automatically triggers a See input command after every AI response or after a set number of turns. Configurable frequency with credit usage warnings.
- **Auto Enable Scripts** — Automatically retoggles "Enable Scripts" in Scenario Creation.

### 📋 Presets

- **Plot Presets** — Save custom Plot Components for reuse across scenarios. Works best with [BetterRepository](https://github.com/ComputerKWasTaken/BetterRepository)!
- **Character Presets** — Save character profiles and auto-fill scenario entry questions. Never type your character's details repeatedly again!

### 📱 Mobile-Specific

- **Settings Gear** — A BetterDungeon settings button injected directly into the AI Dungeon UI, both on the home page and in adventures.
- **Scrollable Mode Menu** — When Command or Try mode adds extra buttons, the input mode menu becomes horizontally scrollable with a gradient fade hint.

## How It Works

BetterDungeon Mobile wraps AI Dungeon's web interface in an Android WebView and injects the same JavaScript and CSS that powers the browser extension. A polyfill layer maps Chrome extension APIs (storage, messaging, runtime) to native Android equivalents through a Kotlin bridge.

<details>
<summary>Click to expand technical details</summary>

### Architecture

- **MainActivity** — Hosts the primary WebView (AI Dungeon) and a secondary WebView (popup/settings panel)
- **InjectionEngine** — Reads all JS/CSS from assets and injects them into the WebView on page load, in the same order as the browser extension's `manifest.json`
- **BetterDungeonBridge** — `@JavascriptInterface` bridge exposed as `BetterDungeonBridge` in JS. Provides SharedPreferences-backed storage, cross-WebView messaging, and asset access
- **WebView Polyfill** — Replaces `chrome.*` extension APIs with Android equivalents so the extension's JS runs unmodified

### Tech Stack

- **Kotlin** for the Android host application
- **JavaScript (ES6+)** for all BetterDungeon features (shared with the browser extension)
- **CSS3** with custom properties for theming
- **WebView** with JavaScript interface bridges

</details>

## Usage

1. Open BetterDungeon Mobile — it loads [AI Dungeon](https://play.aidungeon.com) automatically
2. Tap the ⚙️ BetterDungeon gear icon to toggle features and access settings
3. Play your adventure with all the goodies

Settings persist across sessions via Android SharedPreferences.

## Support

- [Found a bug?](../../issues) Report it on GitHub
- [Feature idea?](../../issues/new) I'd love to hear it
- Need help? Check the [Contributing Guide](CONTRIBUTING.md) for technical details
- Contact me on Discord: `@computerK`

---

**Made with ❤️ for the AI Dungeon community**
