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
        max-width: calc(100vw - var(--bd-menu-left, 12px) - 8px) !important;
        overflow-x: auto !important;
        overflow-y: hidden !important;
        -webkit-overflow-scrolling: touch;
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
        flex-shrink: 0 !important;
      }
    `;
    document.head.appendChild(style);
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
    const el = document.getElementById(GRADIENT_ID);
    if (el) el.remove();
  }

  /** Check whether either Command or Try is currently enabled. */
  function shouldBeActive() {
    const fm = window.betterDungeonInstance?.featureManager;
    if (!fm) return false;
    return fm.isFeatureEnabled('command') || fm.isFeatureEnabled('try');
  }

  /** Apply or tear down the scrollable menu based on current feature state. */
  function sync() {
    const active = shouldBeActive();
    if (active) {
      injectScrollStyles();
      // If the menu is already in the DOM, attach the gradient now
      const menu = document.querySelector('[data-bd-mode-menu]');
      if (menu) injectGradient(menu);
    } else {
      removeScrollStyles();
      removeGradient();
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

    const menu = document.querySelector('[data-bd-mode-menu]');
    if (menu && !menu.querySelector('#' + GRADIENT_ID)) {
      injecting = true;
      injectScrollStyles();
      injectGradient(menu);
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
