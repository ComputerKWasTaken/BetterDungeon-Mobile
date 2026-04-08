// ═══ mobile_settings_layer.js ═══
// Injects BetterDungeon settings access directly into the AI Dungeon UI on mobile.

(function() {
    'use strict';

    console.log('[BetterDungeon] Starting Mobile Settings Layer Injection');

    const gearHomeHtml = `
<div class="bd-mobile-settings is_View _btc-0active-transparent _brc-0active-transparent _bbc-0active-transparent _blc-0active-transparent _pos-relative _fd-column _btw-1px _brw-1px _bbw-1px _blw-1px _btc-transparent _brc-transparent _bbc-transparent _blc-transparent _btlr-t-radius-64 _btrr-t-radius-64 _bbrr-t-radius-64 _bblr-t-radius-64 _bbs-solid _bts-solid _bls-solid _brs-solid"><div aria-label="BetterDungeon Settings" role="button" class="is_Button is_View _btc-0hover-transparent _brc-0hover-transparent _bbc-0hover-transparent _blc-0hover-transparent _bxsh-0hover-0px0px0pxrg933189164 _btc-0active-transparent _brc-0active-transparent _bbc-0active-transparent _blc-0active-transparent _bxsh-0active-0px0px0pxrg933189164 _cur-pointer _ussel-none _pos-relative _jc-center _ai-center _h-t-size-5 _btlr-t-radius-10 _btrr-t-radius-10 _bbrr-t-radius-10 _bblr-t-radius-10 _pr-t-space-0 _pl-t-space-0 _fd-row _bg-background _btc-borderColor _brc-borderColor _bbc-borderColor _blc-borderColor _btw-1px _brw-1px _bbw-1px _blw-1px _gap-t-space-1 _outlineColor-coreA0 _pt-t-space-0 _pb-t-space-0 _w-t-size-5 _mah-t-size-5 _maw-t-size-5 _ox-hidden _oy-hidden _bbs-solid _bts-solid _bls-solid _brs-solid _bxsh-0px0px0pxva26674076"><div class="is_View _pos-relative _fd-column _t-2--6537 _l-0px _ai-center _jc-center"><span aria-hidden="true" class="is_Text font_icons _col-color _ff-f-family _lh-f-lineHeigh112920 _ls-f-letterSpa1360334204 _mt-0px _mb-0px _fow-500 _ws-break-space115 _mr-0px _ml-0px _pe-none _pt-t-space-0--53 _pb-t-space-0--53 _fos-f-size-1 _zi-1">w_settings</span></div></div></div>
    `;

    const gearAdventureHtml = `
<span class="bd-mobile-settings t_sub_theme t_coreA1 is_Theme" style="color: var(--color); display: contents;"><div id="game-blur-button" aria-label="BetterDungeon Settings" role="button" class="is_Button is_View _bg-0hover-backgroundH3423444 _btc-0hover-borderColor69916956 _brc-0hover-borderColor69916956 _bbc-0hover-borderColor69916956 _blc-0hover-borderColor69916956 _bxsh-0hover-0px0px0pxva926910726 _bg-0active-backgroundP3496915 _btc-0active-borderColor77378595 _brc-0active-borderColor77378595 _bbc-0active-borderColor77378595 _blc-0active-borderColor77378595 _bxsh-0active-0px0px0pxva695599917 _bg-0focus-backgroundF3405682 _btc-0focus-borderColor68052152 _brc-0focus-borderColor68052152 _bbc-0focus-borderColor68052152 _blc-0focus-borderColor68052152 _bxsh-0focus-0px0px0pxva984719650 _cur-pointer _ussel-none _ox-visible _oy-visible _pos-relative _jc-center _ai-center _h-t-size-5 _btlr-t-radius-10 _btrr-t-radius-10 _bbrr-t-radius-10 _bblr-t-radius-10 _pr-t-space-0 _pl-t-space-0 _fd-row _bg-background _btc-borderColor _brc-borderColor _bbc-borderColor _blc-borderColor _btw-1px _brw-1px _bbw-1px _blw-1px _gap-t-space-1 _outlineColor-coreA0 _pt-t-space-0 _pb-t-space-0 _w-t-size-5 _mah-t-size-5 _maw-t-size-5 _bbs-solid _bts-solid _bls-solid _brs-solid _bxsh-0px0px0pxva26674076"><div class="is_View _pos-relative _fd-column _t-2--6537 _l-0px _ai-center _jc-center"><span aria-hidden="true" class="is_Text font_icons _col-core9 _ff-f-family _lh-f-lineHeigh112920 _ls-f-letterSpa1360334204 _mt-0px _mb-0px _fow-500 _ws-break-space115 _mr-0px _ml-0px _pe-none _pt-t-space-0--53 _pb-t-space-0--53 _fos-f-size-2 _zi-1">w_settings</span></div></div></span>
    `;

    function onSettingsClick(e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        console.log('[BetterDungeon] Triggering Settings Popup');
        if (window.BetterDungeonBridge && typeof window.BetterDungeonBridge.showPopup === 'function') {
            window.BetterDungeonBridge.showPopup();
        } else {
            console.warn('[BetterDungeon] BetterDungeonBridge is not available.');
        }
    }

    function injectSettingsButtons() {
        // 1. Home Page Target
        const homeMenuTarget = document.querySelector('div[aria-label="Daily Rewards"]')?.closest('.is_Row');
        if (homeMenuTarget && !homeMenuTarget.querySelector('.bd-mobile-settings')) {
            const template = document.createElement('template');
            template.innerHTML = gearHomeHtml.trim();
            const node = template.content.firstChild;
            node.addEventListener('click', onSettingsClick);
            // Insert before the user avatar menu (usually the last child)
            homeMenuTarget.insertBefore(node, homeMenuTarget.lastElementChild);
        }

        // 2. Adventure Page Target (next to the Model Switcher / Undo / Redo)
        // Find the specific wrapper by looking for the "Game settings" or "Undo change" aria-labels
        const adventureMenuTargets = document.querySelectorAll('div[aria-label="Game settings"]');
        adventureMenuTargets.forEach(target => {
            const rowWrapper = target.closest('.is_Row');
            if (rowWrapper && rowWrapper.querySelector('div[aria-label="Undo change"]') && !rowWrapper.querySelector('.bd-mobile-settings')) {
                const template = document.createElement('template');
                template.innerHTML = gearAdventureHtml.trim();
                const node = template.content.firstChild;
                node.addEventListener('click', onSettingsClick);
                rowWrapper.appendChild(node);
            }
        });
    }

    // Set up a MutationObserver to watch for these elements as they are dynamically rendered via React
    const observer = new MutationObserver(() => {
        injectSettingsButtons();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Initial check
    injectSettingsButtons();

})();
