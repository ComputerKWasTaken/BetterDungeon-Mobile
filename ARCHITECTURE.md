# BetterDungeon Android Architecture

Transforming a Chrome browser extension into a reliable and standalone Android mobile application without heavily fragmenting the codebases requires a bridge to cross-communicate data APIs to different environments. Here is an overview of how the BetterDungeon Android app bridges these bounds.

## The Injection Engine

Instead of rewriting BetterDungeon natively in Android/Kotlin UI templates—which would require immense amounts of duplicate work and separate update pipelines when website APIs break—we use an `InjectionEngine` written in `InjectionEngine.kt`.

When the main `WebView` successfully finishes loading a domain pointing to `play.aidungeon.com`:
1. The `InjectionEngine` triggers.
2. It parses the ordered script queue (found in standard Chrome Extension manifest structures).
3. Using `WebView.evaluateJavascript()`, the engine runs the extension logic identically inside of the mobile WebView instance, meaning DOM modifications and visual changes occur in the same way they do in Chrome Extension DOM manipulation.

## `BetterDungeonBridge.kt` and The Polyfill

Browser environments possess a unique `chrome.*` API namespace specifically dedicated to tracking extensions. This namespace allows storage syncing and background listeners for content pop-ups. Android `WebViews` don't possess this interface out of the box, meaning if left unattended, the codebase encounters undefined runtime errors trying to invoke it!

We solve this using **Javascript Interfaces**.
- **`webview-polyfill.js`**: Replaces the standard browser implementation, acting as the very first script injected upon DOM load. It injects a global `chrome` object instance matching the necessary subset required by the app.
- **`BetterDungeonBridge.kt`**: Maps native calls passed from the javascript interface dynamically out to hardware Android calls.
  - When the JS calls `chrome.storage.sync.set()`, the `BetterDungeonBridge` intercepts it, parsing the JSON map, and stores it offline inside an Android `SharedPreferences` preference container!
  - Cross-communication works completely seamlessly using a unified in-page event bus structure between `popup.html` and the main `WebView` framework.

## UI Overlays and Windows

Instead of using modern tools like Jetpack Compose or bottom slide-up sheets (which restrict height maps natively), this architecture relies heavily on raw native Views managed sequentially by a `FrameLayout`. 

Toggling the bottom-right floating action button surfaces a hidden `popupContainer` view, which hosts *a second* `WebView` element pointing straight at the compiled `popup.html` extension UI! It acts as a full-size display overlay rendering exactly as users expect the extension menu to render inside desktop browsers.
