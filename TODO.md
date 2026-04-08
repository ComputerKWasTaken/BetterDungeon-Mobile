# BetterDungeon Mobile Port - TODO & Testing Tracker

This document tracks the manual testing, adjustments, and fixes required to ensure all features of the BetterDungeon extension work beautifully on the mobile Android port.

## Feature Testing Checklist

Mark features as `[x]` when fully tested and perfectly ported. If a feature is broken or requires mobile-specific adjustments, add notes below it explaining why.

- [ ] **Markdown Feature** (`markdown_feature.js`)
  - *Notes:*
- [ ] **Command Mode** (`command_feature.js`)
  - *Notes:*
- [ ] **Try Mode** (`try_feature.js`)
  - *Notes:*
- [ ] **Trigger Highlight** (`trigger_highlight_feature.js`)
  - *Notes:* 
- [ ] **Hotkey Feature** (`hotkey_feature.js`)
  - *Notes:* Keyboard shortcuts might require a virtual keyboard interface or be entirely overhauled/disabled for mobile touch interfaces.
- [ ] **Plot Presets** (`plot_presets_feature.js`)
  - *Notes:*
- [ ] **Input Mode Colors** (`input_mode_color_feature.js`)
  - *Notes:*
- [ ] **Character Presets** (`character_preset_feature.js`)
  - *Notes:*
- [ ] **Auto See** (`auto_see_feature.js`)
  - *Notes:*
- [ ] **Story Card Analytics** (`story_card_analytics_feature.js`)
  - *Notes:* Check if the UI fits properly on narrow mobile screens.
- [ ] **Notes Feature** (`notes_feature.js`)
  - *Notes:*
- [ ] **Auto Enable Scripts** (`auto_enable_scripts_feature.js`)
  - *Notes:*
- [ ] **Story Card Modal Dock** (`story_card_modal_dock_feature.js`)
  - *Notes:*
- [ ] **Better Scripts** (`better_scripts_feature.js`)
  - *Notes:*
- [ ] **Input History** (`input_history_feature.js`)
  - *Notes:* Swiping up/down on a virtual keyboard might not translate well; may need UI buttons.

## Miscellaneous / Architectural Issues

Track issues regarding the Android wrapper, Webview limitations, and overall port structure here.

- [ ] Provide handling for hardware back-button navigation within the main WebView vs closing the popup/app. (Mostly implemented, needs battle testing)
- [ ] Ensure the full-screen popup menu scrolls smoothly and doesn't get cut off by system navigation bars or notches.
- [ ] Handle potential zooming issues inside the WebView (prevent accidental pinch-to-zoom if it ruins the layout).
- [ ] Verify that `SharedPreferences` saves persist correctly when force-closing the app.
- [ ] Adjust any hover-based UI elements from the desktop extension to work logically with mobile touch events (e.g., tap to show tooltips).
