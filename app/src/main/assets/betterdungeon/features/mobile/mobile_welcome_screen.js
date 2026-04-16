// ═══ mobile_welcome_screen.js ═══
// First-time welcome screen that guides new users through BetterDungeon's
// key features. Shows once on first launch, then never again (persisted
// via chrome.storage.sync). Can be re-triggered from the popup help button.

(function () {
  'use strict';

  var STORAGE_KEY = 'betterDungeon_welcomeCompleted';
  var OVERLAY_ID = 'bd-welcome-overlay';
  var TOTAL_PAGES = 5;
  var currentPage = 0;

  // ── Page Content ─────────────────────────────────────────────────

  var iconUrl = (typeof chrome !== 'undefined' && chrome.runtime)
    ? chrome.runtime.getURL('icons/icon128.png')
    : '';

  var pages = [
    {
      icon: 'icon-sparkles',
      iconColor: 'var(--bd-accent-primary)',
      accentRgb: '255, 149, 0',
      title: 'Welcome to BetterDungeon',
      subtitle: 'Your AI Dungeon experience, supercharged',
      description: 'BetterDungeon adds powerful tools for writing, storytelling, and scenario building, all optimized for mobile.',
      hint: 'Swipe or tap the arrow to continue',
      previewHtml:
        '<div class="bd-welcome-preview bd-welcome-preview-logo">' +
          '<img src="' + iconUrl + '" class="bd-welcome-logo-img" alt="BetterDungeon">' +
        '</div>'
    },
    {
      icon: 'icon-terminal',
      iconColor: 'var(--bd-orange)',
      accentRgb: '249, 115, 22',
      title: 'Command & Try Modes',
      subtitle: 'New ways to interact with the AI',
      description: 'Use <strong>Command Mode</strong> to send direct instructions to the AI without them appearing in the story. <strong>Try Mode</strong> adds dice-roll mechanics with configurable success odds.',
      hint: 'Find these in the input mode menu',
      previewHtml:
        '<div class="bd-welcome-preview bd-welcome-preview-modes">' +
          '<div class="bd-welcome-mock-btn" style="--mock-rgb: 249,115,22">' +
            '<span class="icon-terminal" style="font-size:11px"></span> Command' +
          '</div>' +
          '<div class="bd-welcome-mock-btn" style="--mock-rgb: 168,85,247">' +
            '<span class="icon-dices" style="font-size:11px"></span> Try' +
          '</div>' +
        '</div>'
    },
    {
      icon: 'icon-pen-line',
      iconColor: 'var(--bd-blue)',
      accentRgb: '59, 130, 246',
      title: 'Markdown & Notes',
      subtitle: 'Rich text and private scratchpad',
      description: '<strong>Markdown</strong> renders bold, italic, headers, and more in your story text. <strong>Adventure Notes</strong> gives you a private scratchpad per adventure that the AI never sees.',
      hint: 'Markdown renders automatically in the story view',
      previewHtml:
        '<div class="bd-welcome-preview bd-welcome-preview-text">' +
          '<div class="bd-welcome-mock-text">' +
            '<span class="bd-welcome-mock-h">The Quest Begins</span>' +
            '<span class="bd-welcome-mock-bold">The knight</span> drew her ' +
            '<span class="bd-welcome-mock-italic">enchanted blade</span>...' +
          '</div>' +
          '<div class="bd-welcome-mock-note">' +
            '<span class="icon-notebook-pen" style="font-size:10px"></span> Notes' +
          '</div>' +
        '</div>'
    },
    {
      icon: 'icon-bookmark',
      iconColor: 'var(--bd-purple)',
      accentRgb: '168, 85, 247',
      title: 'Presets & Triggers',
      subtitle: 'Save time, build worlds',
      description: '<strong>Plot Presets</strong> save your AI Instructions for reuse. <strong>Character Presets</strong> auto-fill scenario entry questions. <strong>Trigger Highlights</strong> show active Story Card keywords.',
      hint: 'Manage presets in the Presets tab',
      previewHtml:
        '<div class="bd-welcome-preview bd-welcome-preview-presets">' +
          '<div class="bd-welcome-mock-preset">' +
            '<span class="icon-bookmark" style="font-size:10px; color:var(--bd-purple)"></span>' +
            ' Dark Fantasy Plot' +
          '</div>' +
          '<div class="bd-welcome-mock-preset">' +
            '<span class="icon-bookmark" style="font-size:10px; color:var(--bd-amber)"></span>' +
            ' Sci-Fi Setting' +
          '</div>' +
          '<div class="bd-welcome-mock-trigger">' +
            '<span class="bd-welcome-mock-trigger-word">dragon</span>' +
            '<span class="bd-welcome-mock-trigger-word">castle</span>' +
          '</div>' +
        '</div>'
    },
    {
      icon: 'icon-circle-check',
      iconColor: 'var(--bd-success)',
      accentRgb: '34, 197, 94',
      title: 'You\'re All Set!',
      subtitle: 'Access settings anytime',
      description: 'Tap the <strong>gear icon</strong> in the top bar to open BetterDungeon settings, toggle features, and manage your presets. Everything is saved automatically.',
      hint: null,
      previewHtml:
        '<div class="bd-welcome-preview bd-welcome-preview-done">' +
          '<div class="bd-welcome-done-check">' +
            '<span class="icon-party-popper" style="font-size:28px; color:var(--bd-accent-primary)"></span>' +
          '</div>' +
        '</div>'
    }
  ];

  // ── Build the Welcome Screen DOM ─────────────────────────────────

  function buildOverlay() {
    // Prevent duplicates
    if (document.getElementById(OVERLAY_ID)) return null;

    var overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'bd-welcome-overlay';

    // Container
    var container = document.createElement('div');
    container.className = 'bd-welcome-container';

    // Card
    var card = document.createElement('div');
    card.className = 'bd-welcome-card';

    // Pages wrapper (horizontal slider)
    var slider = document.createElement('div');
    slider.className = 'bd-welcome-slider';

    for (var i = 0; i < pages.length; i++) {
      var page = pages[i];
      var pageEl = document.createElement('div');
      pageEl.className = 'bd-welcome-page';
      if (i === 0) pageEl.classList.add('active');

      pageEl.innerHTML =
        '<div class="bd-welcome-icon-wrap" style="--icon-rgb:' + page.accentRgb + '">' +
          '<span class="bd-welcome-icon ' + page.icon + '" style="color:' + page.iconColor + '"></span>' +
        '</div>' +
        '<h1 class="bd-welcome-title">' + page.title + '</h1>' +
        '<p class="bd-welcome-subtitle">' + page.subtitle + '</p>' +
        (page.previewHtml || '') +
        '<p class="bd-welcome-description">' + page.description + '</p>' +
        (page.hint ? '<p class="bd-welcome-hint">' + page.hint + '</p>' : '');

      slider.appendChild(pageEl);
    }

    card.appendChild(slider);

    // Dots indicator
    var dots = document.createElement('div');
    dots.className = 'bd-welcome-dots';
    for (var d = 0; d < TOTAL_PAGES; d++) {
      var dot = document.createElement('span');
      dot.className = 'bd-welcome-dot' + (d === 0 ? ' active' : '');
      dot.dataset.page = d;
      dots.appendChild(dot);
    }
    card.appendChild(dots);

    // Navigation buttons
    var nav = document.createElement('div');
    nav.className = 'bd-welcome-nav';

    var backBtn = document.createElement('button');
    backBtn.className = 'bd-welcome-btn bd-welcome-btn-back';
    backBtn.textContent = 'Back';
    backBtn.style.visibility = 'hidden';

    var nextBtn = document.createElement('button');
    nextBtn.className = 'bd-welcome-btn bd-welcome-btn-next';
    nextBtn.textContent = 'Next';

    var skipBtn = document.createElement('button');
    skipBtn.className = 'bd-welcome-btn bd-welcome-btn-skip';
    skipBtn.textContent = 'Skip';

    nav.appendChild(backBtn);
    nav.appendChild(skipBtn);
    nav.appendChild(nextBtn);

    card.appendChild(nav);
    container.appendChild(card);
    overlay.appendChild(container);

    return {
      overlay: overlay,
      slider: slider,
      dots: dots,
      backBtn: backBtn,
      nextBtn: nextBtn,
      skipBtn: skipBtn
    };
  }

  // ── Navigation Logic ─────────────────────────────────────────────

  function goToPage(els, page) {
    if (page < 0 || page >= TOTAL_PAGES) return;
    currentPage = page;

    // Slide pages
    var pageEls = els.slider.querySelectorAll('.bd-welcome-page');
    for (var i = 0; i < pageEls.length; i++) {
      pageEls[i].classList.toggle('active', i === page);
    }
    els.slider.style.transform = 'translateX(-' + (page * 100) + '%)';

    // Update dots
    var dotEls = els.dots.querySelectorAll('.bd-welcome-dot');
    for (var j = 0; j < dotEls.length; j++) {
      dotEls[j].classList.toggle('active', j === page);
    }

    // Update buttons
    els.backBtn.style.visibility = page === 0 ? 'hidden' : 'visible';

    if (page === TOTAL_PAGES - 1) {
      els.nextBtn.textContent = 'Get Started';
      els.nextBtn.classList.add('bd-welcome-btn-finish');
      els.skipBtn.style.display = 'none';
    } else {
      els.nextBtn.textContent = 'Next';
      els.nextBtn.classList.remove('bd-welcome-btn-finish');
      els.skipBtn.style.display = '';
    }
  }

  // ── Dismiss & Persist ────────────────────────────────────────────

  function dismiss(overlay) {
    overlay.classList.add('bd-welcome-dismissing');
    setTimeout(function () {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }, 300);

    // Mark as completed
    chrome.storage.sync.set({ betterDungeon_welcomeCompleted: true });
  }

  // ── Touch / Swipe Support ────────────────────────────────────────

  function setupSwipe(els) {
    var startX = 0;
    var startY = 0;
    var isDragging = false;

    els.slider.addEventListener('touchstart', function (e) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isDragging = true;
    }, { passive: true });

    els.slider.addEventListener('touchend', function (e) {
      if (!isDragging) return;
      isDragging = false;

      var dx = e.changedTouches[0].clientX - startX;
      var dy = e.changedTouches[0].clientY - startY;

      // Only register horizontal swipes (ignore vertical scrolling)
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0 && currentPage < TOTAL_PAGES - 1) {
          goToPage(els, currentPage + 1);
        } else if (dx > 0 && currentPage > 0) {
          goToPage(els, currentPage - 1);
        }
      }
    }, { passive: true });
  }

  // ── Show Welcome Screen ──────────────────────────────────────────

  function show() {
    currentPage = 0;

    var els = buildOverlay();
    if (!els) return; // already open

    document.body.appendChild(els.overlay);

    // Trigger entrance animation on next frame
    requestAnimationFrame(function () {
      els.overlay.classList.add('bd-welcome-visible');
    });

    // Event listeners
    els.nextBtn.addEventListener('click', function () {
      if (currentPage === TOTAL_PAGES - 1) {
        dismiss(els.overlay);
      } else {
        goToPage(els, currentPage + 1);
      }
    });

    els.backBtn.addEventListener('click', function () {
      goToPage(els, currentPage - 1);
    });

    els.skipBtn.addEventListener('click', function () {
      dismiss(els.overlay);
    });

    // Dot clicks
    var dotEls = els.dots.querySelectorAll('.bd-welcome-dot');
    dotEls.forEach(function (dot) {
      dot.addEventListener('click', function () {
        goToPage(els, parseInt(dot.dataset.page, 10));
      });
    });

    // Swipe
    setupSwipe(els);
  }

  // ── Entry Point ──────────────────────────────────────────────────

  // Expose globally so the popup help button can re-trigger it
  window.__bdShowWelcome = show;

  // Check storage and show if first time
  chrome.storage.sync.get(STORAGE_KEY, function (result) {
    if (!result || !result[STORAGE_KEY]) {
      // First time — wait a moment for AI Dungeon to finish rendering
      // so the overlay sits on top of the loaded page rather than a blank screen.
      setTimeout(function () {
        show();
      }, 1500);
    }
  });

  console.log('[BetterDungeon] Mobile Welcome Screen initialized');
});
