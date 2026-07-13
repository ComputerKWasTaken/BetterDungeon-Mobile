// ═══ mobile_design_layer.js ═══
// Mobile-specific UI enhancements for the input mode switcher menu.
// Converts the input mode menu from a static element to a scrollable
// container when Command or Try mode is enabled (since those modes
// inject extra buttons that overflow on narrow screens).
// Also injects a gradient fade affordance so the player knows the
// menu is scrollable.

(function () {
  'use strict';

  const STYLE_ID = 'bd-mobile-mode-menu-styles';
  const GRADIENT_ID = 'bd-mode-menu-gradient';
  const TOUCH_DRAG_THRESHOLD = 6;
  const touchBindings = new Map();

  function findInputModeMenu() {
    const button = document.querySelector('[aria-label="Set to \'Do\' mode"]') ||
      document.querySelector('[aria-label="Set to \'Story\' mode"]') ||
      document.querySelector('[aria-label="Set to \'Try\' mode"]') ||
      document.querySelector('[aria-label="Set to \'Command\' mode"]');
    return button?.parentElement || null;
  }

  function markMenu(menu) {
    if (!menu) return null;
    menu.setAttribute('data-bd-mode-menu', 'true');
    const menuLeft = parseFloat(menu.style.left) || Math.max(8, Math.round(menu.getBoundingClientRect().left || 12));
    menu.style.setProperty('--bd-menu-left', `${menuLeft}px`);
    return menu;
  }

  /** Inject the <style> tag that makes [data-bd-mode-menu] scrollable. */
  function injectScrollStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* Make the expanded input-mode menu horizontally scrollable.
         React sets overflow:hidden as an inline style on the container;
         !important overrides it so our scroll behaviour persists. */
      [data-bd-mode-menu] {
        /* AI Dungeon 2.16.14 changed this to flex: 0 1 0% inline. Give the
           absolutely-positioned menu an intrinsic width again so its children
           overflow inside the viewport instead of being clipped by it. */
        width: max-content !important;
        max-width: calc(100vw - var(--bd-menu-left, 12px) - 8px) !important;
        flex: 0 0 auto !important;
        overflow-x: auto !important;
        overflow-y: hidden !important;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior-x: contain;
        touch-action: pan-x;
        flex-wrap: nowrap !important;
      }

      /* Hide the scrollbar but keep scroll functional */
      [data-bd-mode-menu]::-webkit-scrollbar {
        display: none;
      }
      [data-bd-mode-menu] {
        scrollbar-width: none;   /* Firefox */
        -ms-overflow-style: none; /* IE/Edge */
      }

      /* Prevent buttons from shrinking — let the menu scroll instead */
      [data-bd-mode-menu] > [role="button"] {
        flex: 0 0 auto !important;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * AI Dungeon's keyboard/scroll rewrite can claim the touch gesture from an
   * ancestor before WebView performs native overflow scrolling. Keep a small
   * manual drag fallback on the menu itself. Taps and vertical gestures are
   * left alone so mode buttons and the game scroller retain normal behavior.
   */
  function enableTouchScrolling(menu) {
    if (!menu || touchBindings.has(menu)) return;

    const state = {
      tracking: false,
      dragging: false,
      startX: 0,
      startY: 0,
      startScrollLeft: 0,
      suppressClickUntil: 0
    };

    const onTouchStart = (event) => {
      if (event.touches.length !== 1 || menu.scrollWidth <= menu.clientWidth) return;
      const touch = event.touches[0];
      state.tracking = true;
      state.dragging = false;
      state.startX = touch.clientX;
      state.startY = touch.clientY;
      state.startScrollLeft = menu.scrollLeft;
    };

    const onTouchMove = (event) => {
      if (!state.tracking || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const deltaX = touch.clientX - state.startX;
      const deltaY = touch.clientY - state.startY;

      if (!state.dragging) {
        if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < TOUCH_DRAG_THRESHOLD) return;
        if (Math.abs(deltaX) <= Math.abs(deltaY)) {
          state.tracking = false;
          return;
        }
        state.dragging = true;
        state.suppressClickUntil = Date.now() + 400;
      }

      menu.scrollLeft = state.startScrollLeft - deltaX;
      event.preventDefault();
      event.stopPropagation();
    };

    const onTouchEnd = () => {
      state.tracking = false;
      state.dragging = false;
    };

    const onClick = (event) => {
      if (Date.now() > state.suppressClickUntil) return;
      state.suppressClickUntil = 0;
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    menu.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
    menu.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
    menu.addEventListener('touchend', onTouchEnd, { capture: true, passive: true });
    menu.addEventListener('touchcancel', onTouchEnd, { capture: true, passive: true });
    menu.addEventListener('click', onClick, true);

    touchBindings.set(menu, () => {
      menu.removeEventListener('touchstart', onTouchStart, true);
      menu.removeEventListener('touchmove', onTouchMove, true);
      menu.removeEventListener('touchend', onTouchEnd, true);
      menu.removeEventListener('touchcancel', onTouchEnd, true);
      menu.removeEventListener('click', onClick, true);
    });
  }

  function disableTouchScrolling() {
    for (const removeListeners of touchBindings.values()) removeListeners();
    touchBindings.clear();
  }

  /** Remove the scroll styles. */
  function removeScrollStyles() {
    const el = document.getElementById(STYLE_ID);
    if (el) el.remove();
  }

  /**
   * Inject a gradient fade element on the right edge of the menu
   * to hint that more buttons are available via scrolling.
   */
  function injectGradient(menu) {
    if (!menu) return;

    // Avoid duplicate
    if (menu.querySelector('#' + GRADIENT_ID)) return;

    // The gradient must sit inside the menu's coordinate space.
    // The menu is position:absolute from AI Dungeon, so we can use
    // a sticky-right child that floats at the trailing edge.
    const gradient = document.createElement('div');
    gradient.id = GRADIENT_ID;
    gradient.style.cssText = `
      position: sticky;
      right: 0;
      top: 0;
      bottom: 0;
      min-width: 28px;
      width: 28px;
      flex-shrink: 0;
      pointer-events: none;
      background: linear-gradient(to right, transparent, var(--background, rgba(0,0,0,0.85)) 80%);
      z-index: 1;
      margin-left: -28px;
    `;
    menu.appendChild(gradient);

    // Hide the gradient once the user has scrolled to the end
    const updateGradientVisibility = () => {
      const atEnd = menu.scrollLeft + menu.clientWidth >= menu.scrollWidth - 2;
      gradient.style.opacity = atEnd ? '0' : '1';
    };
    gradient.style.transition = 'opacity 0.2s ease';
    menu.addEventListener('scroll', updateGradientVisibility, { passive: true });
    // Run once on inject to set initial state
    requestAnimationFrame(updateGradientVisibility);
  }

  /** Remove gradient elements from the menu. */
  function removeGradient() {
    document.querySelectorAll('#' + GRADIENT_ID).forEach((el) => el.remove());
  }

  /** Check whether either Command or Try is currently enabled. */
  function shouldBeActive() {
    const fm = window.betterDungeonInstance?.featureManager;
    const managerEnabled = !!fm &&
      (fm.isFeatureEnabled('command') || fm.isFeatureEnabled('try'));

    // mobile_design_layer.js loads before main.js. During startup, the custom
    // buttons can be injected before window.betterDungeonInstance is visible,
    // so the DOM is also a reliable source of truth for this short race.
    const customButtonPresent = !!document.querySelector(
      '[aria-label="Set to \'Try\' mode"], [aria-label="Set to \'Command\' mode"]'
    );
    return managerEnabled || customButtonPresent;
  }

  function activateMenu(menu) {
    menu = markMenu(menu);
    if (!menu) return null;

    // React replaces this menu rather than updating it in place. Release
    // listeners held for detached versions before binding the current one.
    for (const [boundMenu, removeListeners] of touchBindings.entries()) {
      if (boundMenu.isConnected) continue;
      removeListeners();
      touchBindings.delete(boundMenu);
    }

    injectScrollStyles();
    enableTouchScrolling(menu);
    injectGradient(menu);
    return menu;
  }

  /** Apply or tear down the scrollable menu based on current feature state. */
  function sync() {
    const active = shouldBeActive();
    if (active) {
      activateMenu(document.querySelector('[data-bd-mode-menu]') || findInputModeMenu());
    } else {
      removeScrollStyles();
      removeGradient();
      disableTouchScrolling();
    }
  }

  // --- Lifecycle ---

  // Re-entrancy guard: prevent the observer from reacting to DOM changes
  // caused by our own gradient injection (which would trigger an infinite loop).
  let injecting = false;

  // 1. MutationObserver: whenever the menu appears/re-renders, sync.
  const observer = new MutationObserver(() => {
    if (injecting) return;
    if (!shouldBeActive()) return;

    const menu = document.querySelector('[data-bd-mode-menu]') || findInputModeMenu();
    if (menu && (!menu.querySelector('#' + GRADIENT_ID) || !touchBindings.has(menu))) {
      injecting = true;
      activateMenu(menu);
      injecting = false;
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // 2. Listen for feature toggles from the popup so we can
  //    enable/disable the design layer reactively.
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'FEATURE_TOGGLE' &&
          (message.featureId === 'command' || message.featureId === 'try')) {
        // Small delay so FeatureManager has time to update its state
        setTimeout(sync, 50);
      }
    });
  }

  // 3. Initial sync (features may already be loaded by now)
  sync();
})();
