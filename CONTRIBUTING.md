# Contributing to BetterDungeon Android

This repository serves as a direct port bridging the standalone capabilities of the main BetterDungeon Chrome Extension.

When attempting to introduce new features, mechanics, or bug fixes, it is critical to realize that there is a **dual-maintainer** ecosystem actively running!

## Syncing Extensions

The core source code of the Web Extension itself lives entirely within the `app/src/main/assets/betterdungeon` directory. 

If the primary BetterDungeon web extension receives significant structure overhauls or feature additions, you will need to map these changes here. However, **this is rarely a 1-to-1 conversion out of the box!**

While the Android WebView architecture flawlessly handles JS evaluation and CSS injection, things may still break visibly on mobile devices! When porting changes:
1. Update the necessary scripts inside `assets`.
2. Determine if the new JS scripts implemented in the original Chrome Extension branch should be added manually into the ordered injection array queue inside `InjectionEngine.kt`.
3. **Important Check**: Always perform manual QA! You will almost certainly have to actively alter injected logic or tweak visual CSS outputs to align these new features cleanly into the Android mobile screen resolutions and form factors!

As AI Dungeon frequently releases updates, stay in sync with the primary BetterDungeon codebase while continually fine-tuning these modifications to guarantee structural web view padding constraints don't shatter or cause logic to cascade out.
