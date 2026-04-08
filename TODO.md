# BetterDungeon Mobile Port - TODO & Testing Tracker

This document tracks the manual testing, adjustments, and fixes required to ensure all features of the BetterDungeon extension work beautifully on the mobile Android port.

## Feature Testing Checklist

Mark features as `[OK]` when fully tested and perfectly ported. If a feature is broken or requires mobile-specific adjustments, add notes below it explaining why.
Mark features as `[~OK]` when they are mostly working but need further adjustments
Mark features as `[~X]` when they are barely working and need major adjustments
Mark features as `[X]` when they are not working at all
Mark features as `[?]` when they can't be tested or are not applicable on mobile (e.g., keyboard shortcuts that don't exist on touch devices).

- [X] **Markdown Feature** (`markdown_feature.js`)
  - *Notes:* The formatting in of itself doesn't seem to work, and the automatic application system that applies the necessary Markdown instructions doesn't work. (DOM navigation issue?)
- [~OK] **Command Mode** (`command_feature.js`)
  - *Notes:* Might work, but it is pushed off screen due to screen size limitations. The options need to be adjusted (maybe above the standard options) in order to prevent the button from being displaced off screen. Might conflict with the Input Mode Colors if custom theming is not accounted for.
- [~X] **Try Mode** (`try_feature.js`)
  - *Notes:* Although it appears as a button option perfectly fine and shows the success modifier element, this feature doesn't seem to work on mobile. Firstly, we can't modify our success chance from the arrow keys (as to be expected on mobile), but the feature also doesn't seem to work at all. I believe that although it calculates our success, it doesn't actually modify the text that gets sent out to the game as a Do input. Very curious.
- [?] **Trigger Highlight** (`trigger_highlight_feature.js`)
  - *Notes:* 
- [?] **Hotkey Feature** (`hotkey_feature.js`)
  - *Notes:* Hidden from mobile popup UI (keyboard-dependent). Feature code still present if future touch-based controls are added.
- [X] **Plot Presets** (`plot_presets_feature.js`)
  - *Notes:* Doesn't seem to be able to navigate the DOM autonomously. Despite the fact that the popup page is basically a new view that renders on top of our WebView. Might be an issue with our navigation system. Our loading screen service works solidly.
- [OK] **Input Mode Colors** (`input_mode_color_feature.js`)
  - *Notes:* Thankfully, this feature works perfectly fine, no issues here.
- [OK] **Character Presets** (`character_preset_feature.js`)
  - *Notes:* Another shocker, this feature works without a hitch. No issues here.
- [OK] **Auto See** (`auto_see_feature.js`)
  - *Notes:* Works perfectly fine, no issues here.
- [~OK] **Story Card Analytics** (`story_card_analytics_feature.js`)
  - *Notes:* This feature pretty much entirely works, but there are some funny issues. Due to the icons not functioning on mobile, they appear as the "missing element" icon. This occurs in any and every feature that uses these custom icons. If I recall correctly, these are Lucide icons. Other than that though, the feature works great.
- [~OK] **Notes Feature** (`notes_feature.js`)
  - *Notes:* This one has to be favorite bug. The Notes element appears, but funnily enough, it appears at the very top of the Settings panel. Our algorithm to determine where we need to place the Notes element must not like how the web interface modifies its DOM when adjusting for the mobile width (remember, the web version of AI Dungeon modifies its sizing when in mobile web sizes to accomodate for those on mobile web. Since our WebView app is basically a mobile web version of AI Dungeon, we can replicate this exact issue on PC. Very cool.)
- [?] **Auto Enable Scripts** (`auto_enable_scripts_feature.js`)
  - *Notes:* Since you can't actually modify scripts on mobile (or on mobile web due to sizing) we can remove this feature.
- [?] **Story Card Modal Dock** (`story_card_modal_dock_feature.js`)
  - *Notes:* This feature is unnecessary on mobile devices and can be removed.
- [OK] **Better Scripts** (`better_scripts_feature.js`)
  - *Notes:* Shockingly works! No issues with Better Scripts. I'm just as surprised as you are. The UI is a bit small, but that's a smaller issue.
- [?] **Input History** (`input_history_feature.js`)
  - *Notes:* Since the Input History feature uses the arrow keys, we can't actually test this on mobile. We'll need to adjust our input method to test the feature.

## Findings and Other Notes

Through my testing, I found a lot of interesting bugs and issues that have popped up. This give good insight to what may be going wrong with out features, and may even give insight to bugs that we may need to fix on the standard version of BetterDungeon.

### Input Box Displacement

Strangely, the input box (the box that appears when you open the Take a Turn menu) causes the page to shift upward. This shifts the entire page up, making the input box and text a lot higher up than they should be. This may be because of the keyboard appearing, but that shouldn't be an issue since we're using a WebView app, and AI Dungeon has a mobile web DOM modification system that doesn't share this behavior. You can scroll on the screen to move the page to account for this displacement, but I really don't know why this occurs. This even occurs when every feature is disabled. We need to look into this behavior further as it's extremely annoying. Nothing breaks, but it's just really annoying and disruptive to the user experience.

### Broken Icons

Pretty much any feature that uses custom icons (like Lucide icons) will not work on mobile. They will appear as the "missing element" icon. This occurs in any and every feature that uses these custom icons.