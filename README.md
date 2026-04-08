# BetterDungeon Mobile Emulator

Welcome to the standalone Android port wrapper for the BetterDungeon browser extension!

This application serves as a mobile client for `play.aidungeon.com` leveraging Android's robust `WebView` system. By wrapping the AI Dungeon website and programmatically injecting the custom scripts and stylesheets that make up the BetterDungeon extension, we achieve an identical modernized UI and feature set right out of the box on mobile devices!

## Getting Started

To build and run this Android application locally, follow these steps:

1. Clone the repository to your local machine.
2. Open the project inside Android Studio.
3. Allow Gradle to sync and install the necessary View/Compat dependencies (such as AndroidX Webkit and Material Components).
4. Run the application via `Run -> Run 'app'` on an emulator or an active USB-connected Android device.

## Core Features

- **Injects BetterDungeon Natively**: All elements of the web extension (CSS, Javascript UI replacements, listeners, etc) are manually bundled in and injected sequentially every time `play.aidungeon.com` triggers a page finish event inside the WebView.
- **Dedicated Floating Setting UI**: The Settings extension pop-up (originally managed by Chrome Extension API's) is handled within a separate, dedicated full-screen `WebView` layer toggled by an easy-to-reach floating action button. 
- **Offline Persistent Storage**: The storage capabilities used in the browser extension (`chrome.storage.sync`) are natively polyfilled using Android's `SharedPreferences` database via a deeply integrated Javascript interface bridge.

## Repository Structure

- `app/src/main/java/`: Contains the backbone of the Kotlin architecture, which acts as the orchestrator to structure the core WebViews and bridge javascript APIs to native ones!
- `app/src/main/assets/betterdungeon`: Important directory! This is the home representation of the core BetterDungeon Chrome Extension.

For a deeper dive into how this all connects, read through [ARCHITECTURE.md](ARCHITECTURE.md) and [CONTRIBUTING.md](CONTRIBUTING.md).
