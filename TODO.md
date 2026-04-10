# BetterDungeon Mobile Port - TODO & Testing Tracker

This document tracks the manual testing, adjustments, and fixes required to ensure all features of the BetterDungeon extension work beautifully on the mobile Android port.

# Current Goal with BetterDungeon (Both PC and Mobile)

The goal at the moment is to ensure BetterDungeon's mobile port is fully stable so it can be built off of. Currently, we are debugging features and fixing broken ones.

Changes and additions we make on the mobile port will later be ported over to the desktop version, if the changes are applicable (as an example, Try mode improvements).

The mobile version and the PC version will be minimally different for ease of development.

Before I work on anything new, I want to make sure that both the mobile port and the PC browser extension are both bug free and both features are locked down. Afterwards, I can work on BetterRepository v1.6, update the Chrome Web Store version of BetterDungeon, and upload BetterDungeon to the Firefox Web Store.

## Feature Testing Checklist

This is a checklist of all major features of the BetterDungeon mobile port. At the moment, we are focusing on getting the mobile port stable and functional.
The core of the mobile port is functional, but the specific features listed need adjusting and polishing in accordance with the listings below.

If a feature is broken or requires mobile-specific adjustments, notes explain why.
Mark features as `[OK]` when fully tested and perfectly ported.
Mark features as `[~OK]` when they are mostly working but need further adjustments
Mark features as `[~X]` when they are barely working and need major adjustments
Mark features as `[X]` when they are not working at all
Mark features as `[?]` when they can't be tested or are not applicable on mobile (e.g., keyboard shortcuts that don't exist on touch devices).

- [OK] **Markdown Feature** (`markdown_feature.js`)
  - No issues currently with the Markdown feature.
- [OK] **Command Mode** (`command_feature.js`)
  - No issues currently with the Command Mode feature.
- [OK] **Try Mode** (`try_feature.js`)
  - No issues currently with the Try mode.
- [X] **Trigger Highlight** (`trigger_highlight_feature.js`)
  - The Trigger Highlight system is porked on both mobile and PC. We'll tackle this one last as we'll probably need to rebuild this from the ground up.
- [~OK] **Plot Presets** (`plot_presets_feature.js`)
  - The Plot Presets feature successfully saves presets, but it won't update the Saved Plot Presets list until you close and reopen the app to cause a refresh.
- [OK] **Input Mode Colors** (`input_mode_color_feature.js`)
  - No issues currently with the Input Mode Colors feature.
- [OK] **Character Presets** (`character_preset_feature.js`)
  - No issues currently with the Character Presets feature.
- [OK] **Auto See** (`auto_see_feature.js`)
  - No issues currently with the Auto See feature.
- [OK] **Story Card Analytics** (`story_card_analytics_feature.js`)
  - No issues currently with the Story Card Analytics feature.
- [~OK] **Notes Feature** (`notes_feature.js`)
  - The Notes feature has 2 main problems it needs to solve:
    1. The Notes feature is not saving our Notes correctly. It appears that when we exit out of the adventure and/or app and come back, our Notes are gone. Most likely not being saved properly.
    2. The Notes feature may occasionally not allow you to edit your Notes, where you can tap on the text input box, but it will immediately kick you out of editing.
- [OK] **Better Scripts** (`better_scripts_feature.js`)
  - No issues currently with Better Scripts.
- [X] **Input History** (`input_history_feature.js`)
  - This feature might work but we need to create a UI element that allows the user to actually switch between their previous inputs.

## Other Issues and PC Bugs (that also need fixing)

- Many features in the popup with buttons within them seem to always return incorrect updates (for example, when pressing Apply Instructions with the Markdown feature, the popup claims that application failed when it did not. These incorrect updates seem to occur with any button inside of our popup.)

- The image icons aren't properly loading (this is most noticable in the loading screen, where the image of the BetterDungeon logo doesn't load and throws the "broken image" icon)
