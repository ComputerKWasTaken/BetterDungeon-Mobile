// ═══ mobile_login_warning.js ═══
// Explains why third-party sign-in cannot complete inside BetterDungeon Mobile's
// embedded WebView and directs players to the supported email/password form.

(function () {
  'use strict';

  const WARNING_ID = 'bd-mobile-login-warning';
  const STYLE_ID = 'bd-mobile-login-warning-styles';
  const PROVIDER_SELECTOR = [
    '[aria-label="Sign in with Google"]',
    '[aria-label="Sign in with Apple"]',
  ].join(', ');

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${WARNING_ID} {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        margin-top: 12px;
        padding: 12px 13px;
        border: 1px solid rgba(251, 191, 36, 0.42);
        border-radius: 10px;
        background: rgba(120, 53, 15, 0.2);
        color: rgba(255, 255, 255, 0.92);
        font-family: inherit;
        font-size: 13px;
        line-height: 1.45;
        text-align: left;
      }

      #${WARNING_ID} .bd-mobile-login-warning-icon {
        flex: 0 0 auto;
        width: 18px;
        height: 18px;
        margin-top: 1px;
        color: #fbbf24;
      }

      #${WARNING_ID} strong {
        color: #fde68a;
        font-weight: 700;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function createWarning() {
    const warning = document.createElement('div');
    warning.id = WARNING_ID;
    warning.setAttribute('role', 'note');
    warning.setAttribute('aria-label', 'BetterDungeon Mobile sign-in notice');
    warning.innerHTML = `
      <svg class="bd-mobile-login-warning-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 9v4m0 4h.01M10.3 3.7 2.6 17a2 2 0 0 0 1.73 3h15.34a2 2 0 0 0 1.73-3L13.7 3.7a2 2 0 0 0-3.4 0Z"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <div>
        <strong>Google and Apple sign-in are not supported in BetterDungeon Mobile.</strong>
        Please use your AI Dungeon email and password below.
      </div>
    `;
    return warning;
  }

  function syncWarning() {
    const providerButtons = Array.from(document.querySelectorAll(PROVIDER_SELECTOR));
    const existing = document.getElementById(WARNING_ID);

    if (providerButtons.length === 0) {
      existing?.remove();
      return;
    }

    ensureStyles();

    const providerRow = providerButtons[0].closest('.is_Row');
    const socialSection = providerRow?.parentElement;
    if (!providerRow || !socialSection) return;

    providerButtons.forEach((button) => {
      button.setAttribute('aria-describedby', WARNING_ID);
    });

    if (existing && existing.parentElement === socialSection) return;
    existing?.remove();
    providerRow.insertAdjacentElement('afterend', createWarning());
  }

  let syncScheduled = false;
  function scheduleSync() {
    if (syncScheduled) return;
    syncScheduled = true;
    requestAnimationFrame(() => {
      syncScheduled = false;
      syncWarning();
    });
  }

  const observer = new MutationObserver(scheduleSync);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  syncWarning();
})();
