// BetterDungeon - Input History Feature
// Terminal-style input history: Save the user's recent inputs in local storage
// Desktop: Ctrl/Meta + Up/Down arrow keys cycle through previously sent actions
// Mobile: Touch-based prev/next buttons appear above the input area

class InputHistoryFeature {
  static id = 'inputHistory';

  constructor() {
    this.enabled = true;
    this.debug = false;
    
    // Selectors
    this.textInputSelector = '#game-text-input';
    this.submitButtonSelector = '[aria-label="Submit action"]';
    this.inputModeMenuSelector = '[aria-label="Change input mode"]';
    
    // Mode selectors
    this.modeSelectors = {
      'do': '[aria-label="Set to \'Do\' mode"]',
      'say': '[aria-label="Set to \'Say\' mode"]',
      'story': '[aria-label="Set to \'Story\' mode"]',
      'see': '[aria-label="Set to \'See\' mode"]',
      'try': '[aria-label="Set to \'Try\' mode"]',
      'command': '[aria-label="Set to \'Command\' mode"]'
    };

    // State
    this.history = [];
    this.historyIndex = -1;
    this.maxHistorySize = 50;
    this.storageKey = 'betterDungeon_inputHistory';
    this.isSettingValue = false;
    this.lastModeSwitchTime = 0;
    this.modeSwitchCooldown = 150;
    
    // Bound handlers for cleanup
    this.boundKeydownHandler = this.handleKeydown.bind(this);
    this.boundClickHandler = this.handleClick.bind(this);
    this.boundInputHandler = this.handleInput.bind(this);

    // Touch navigation UI
    this.historyBar = null;
    this.historyBarObserver = null;
  }

  log(...args) {
    if (this.debug) {
      console.log('[InputHistory]', ...args);
    }
  }

  async init() {
    console.log('[InputHistory] Initializing Input History feature...');
    await this.loadHistory();
    this.attachListeners();
    this.setupHistoryBarObserver();
    console.log('[InputHistory] Initialization complete.');
  }

  destroy() {
    console.log('[InputHistory] Destroying Input History feature...');
    this.detachListeners();
    this.removeHistoryBar();
    if (this.historyBarObserver) {
      this.historyBarObserver.disconnect();
      this.historyBarObserver = null;
    }
    console.log('[InputHistory] Cleanup complete');
  }

  async loadHistory() {
    try {
      const result = await chrome.storage.local.get([this.storageKey]);
      if (result[this.storageKey]) {
        this.history = result[this.storageKey];
        this.log(`Loaded ${this.history.length} history items`);
      }
    } catch (e) {
      console.error('[InputHistory] Error loading history:', e);
    }
  }

  async saveHistory() {
    try {
      await chrome.storage.local.set({ [this.storageKey]: this.history });
    } catch (e) {
      console.error('[InputHistory] Error saving history:', e);
    }
  }

  attachListeners() {
    document.addEventListener('keydown', this.boundKeydownHandler, true);
    document.addEventListener('click', this.boundClickHandler, true);
    document.addEventListener('input', this.boundInputHandler, true);
  }

  detachListeners() {
    document.removeEventListener('keydown', this.boundKeydownHandler, true);
    document.removeEventListener('click', this.boundClickHandler, true);
    document.removeEventListener('input', this.boundInputHandler, true);
  }

  detectCurrentInputMode() {
    const modeButton = document.querySelector(this.inputModeMenuSelector);
    if (modeButton) {
      const modeText = modeButton.querySelector('.font_body');
      if (modeText) {
        const mode = modeText.textContent.toLowerCase().trim();
        return mode;
      }
    }
    return 'do'; // Default
  }

  async setInputMode(mode) {
    const targetMode = mode.toLowerCase();
    const currentMode = this.detectCurrentInputMode();
    
    if (targetMode === currentMode) return;
    
    // Wait for any previous mode switch animation to finish
    const elapsed = Date.now() - this.lastModeSwitchTime;
    if (elapsed < this.modeSwitchCooldown) {
      await new Promise(resolve => setTimeout(resolve, this.modeSwitchCooldown - elapsed));
    }
    
    this.log(`Changing mode from ${currentMode} to ${targetMode}`);
    
    // Open mode menu
    const modeMenuBtn = document.querySelector(this.inputModeMenuSelector);
    if (!modeMenuBtn) return;
    
    modeMenuBtn.click();
    
    // Wait for menu to open
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Select the mode
    const modeSelector = this.modeSelectors[targetMode];
    if (modeSelector) {
      const modeBtn = document.querySelector(modeSelector);
      if (modeBtn) {
        modeBtn.click();
      } else {
        // Fallback: click outside to close if mode button not found
        document.body.click();
      }
    } else {
      // Fallback
      document.body.click();
    }
    
    this.lastModeSwitchTime = Date.now();
  }

  setInputValue(text) {
    const inputElement = document.querySelector(this.textInputSelector);
    if (!inputElement) return;
    
    this.isSettingValue = true;
    
    // Use native value setter to bypass React's tracking, allowing the dispatchEvent to work properly
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set || 
                                   Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                                   
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(inputElement, text);
    } else {
      inputElement.value = text;
    }
    
    // Trigger React's onChange
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Move cursor to end
    setTimeout(() => {
      const activeInput = document.querySelector(this.textInputSelector);
      if (activeInput) {
        activeInput.selectionStart = activeInput.selectionEnd = text.length;
      }
      this.isSettingValue = false;
    }, 10);
  }

  handleInput(e) {
    // Only care if the target is the text input
    if (!e.target || e.target.id !== 'game-text-input') return;
    
    // If we are artificially setting the value from history, don't reset the index
    if (this.isSettingValue) return;
    
    // If the user actually typed something, reset the history index so they can navigate normally
    if (this.historyIndex !== -1) {
      this.historyIndex = -1;
    }
  }

  saveCurrentInput() {
    const inputElement = document.querySelector(this.textInputSelector);
    if (!inputElement) return;
    
    const text = inputElement.value.trim();
    if (!text) return; // Don't save empty inputs
    
    const mode = this.detectCurrentInputMode();
    
    // Don't save if it's identical to the most recent one
    if (this.history.length > 0) {
      const last = this.history[0];
      if (last.text === text && last.mode === mode) {
        this.historyIndex = -1; // Reset index
        return;
      }
    }
    
    // Add to front of history
    this.history.unshift({ mode, text });
    
    // Cap size
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(0, this.maxHistorySize);
    }
    
    this.saveHistory();
    this.historyIndex = -1; // Reset index after sending
    this.log(`Saved input to history: [${mode}] ${text}`);
  }

  async handleKeydown(e) {
    // Only care if the target is the text input
    if (!e.target || e.target.id !== 'game-text-input') return;

    // Save on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      // Execute save synchronously before React clears the input
      this.saveCurrentInput();
      return;
    }

    // Handle history navigation
    if ((e.ctrlKey || e.metaKey) && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      const isUp = e.key === 'ArrowUp';
      
      if (this.history.length === 0) return;
      
      e.preventDefault(); // Prevent cursor movement
      
      if (isUp) {
        // Go older
        if (this.historyIndex < this.history.length - 1) {
          this.historyIndex++;
          this.applyHistoryItem(this.historyIndex);
        }
      } else {
        // Go newer
        if (this.historyIndex > 0) {
          this.historyIndex--;
          this.applyHistoryItem(this.historyIndex);
        } else if (this.historyIndex === 0) {
          // Clear input when going down from newest item
          this.historyIndex = -1;
          this.setInputValue('');
        }
      }
    }
  }

  handleClick(e) {
    // See if we clicked the submit button
    const submitBtn = e.target.closest(this.submitButtonSelector);
    if (submitBtn) {
      this.saveCurrentInput();
    }
  }

  async applyHistoryItem(index) {
    if (index >= 0 && index < this.history.length) {
      const item = this.history[index];
      this.log(`Applying history item ${index}: [${item.mode}] ${item.text}`);
      
      // Instantly update the text
      this.setInputValue(item.text);
      
      // Switch mode with a built-in cooldown to let UI animations finish
      await this.setInputMode(item.mode);

      // Refresh the touch-navigation bar so the counter and button states update
      this.updateHistoryBar();
    }
  }

  // ==================== TOUCH NAVIGATION UI ====================

  // Watch for the game input to appear/disappear and inject the history bar
  setupHistoryBarObserver() {
    this.historyBarObserver = new MutationObserver(() => {
      const input = document.querySelector(this.textInputSelector);
      if (input && this.history.length > 0 && !document.querySelector('#bd-history-bar')) {
        this.injectHistoryBar();
      }
    });
    this.historyBarObserver.observe(document.body, { childList: true, subtree: true });

    // Initial inject attempt
    if (this.history.length > 0) {
      setTimeout(() => this.injectHistoryBar(), 500);
    }
  }

  injectHistoryBar() {
    if (document.querySelector('#bd-history-bar')) return;
    const textarea = document.querySelector(this.textInputSelector);
    if (!textarea) return;

    // The input row (textarea's parent) has position:absolute and bottom padding
    const inputRow = textarea.parentElement;
    if (!inputRow) return;

    const bar = document.createElement('div');
    bar.id = 'bd-history-bar';
    bar.style.cssText = `
      position: absolute;
      top: -36px;
      right: 8px;
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      background: rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      font-family: var(--bd-font-family-primary, 'IBM Plex Sans', sans-serif);
      font-size: 11px;
      color: rgba(255, 255, 255, 0.5);
      z-index: 5;
      pointer-events: auto;
      touch-action: manipulation;
      transition: opacity 0.2s;
    `;

    // Shared touch-friendly button style
    const btnStyle = `
      display:flex; align-items:center; justify-content:center;
      min-width:32px; min-height:28px;
      font-size:14px; font-weight:700; color:rgba(255,255,255,0.6);
      padding:2px 6px; border-radius:5px;
      background:rgba(255,255,255,0.08);
      cursor:pointer; user-select:none;
      -webkit-tap-highlight-color:transparent;
      touch-action:manipulation;
      transition:background .15s, transform .1s;
    `.replace(/\n\s*/g, ' ');

    bar.innerHTML = `
      <span id="bd-history-prev" role="button" aria-label="Previous input" style="${btnStyle}">&#9650;</span>
      <span id="bd-history-counter" style="min-width:24px; text-align:center; font-variant-numeric:tabular-nums; font-weight:600; font-size:10px; letter-spacing:0.3px;"></span>
      <span id="bd-history-next" role="button" aria-label="Next input" style="${btnStyle}">&#9660;</span>
    `;

    // Wire touch + click for prev/next
    const wireTouchBtn = (el, action) => {
      if (!el) return;
      const addPress = () => { el.style.background = 'rgba(255,255,255,0.22)'; el.style.transform = 'scale(0.92)'; };
      const removePress = () => { el.style.background = 'rgba(255,255,255,0.08)'; el.style.transform = ''; };

      el.addEventListener('touchstart', (e) => {
        e.preventDefault(); e.stopPropagation();
        addPress();
        action();
      }, { passive: false });
      el.addEventListener('touchend', (e) => { e.preventDefault(); removePress(); }, { passive: false });
      el.addEventListener('touchcancel', removePress);
      el.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); action(); });
      el.addEventListener('mousedown', addPress);
      el.addEventListener('mouseup', removePress);
      el.addEventListener('mouseleave', removePress);
    };

    wireTouchBtn(bar.querySelector('#bd-history-prev'), () => this.navigateHistory('up'));
    wireTouchBtn(bar.querySelector('#bd-history-next'), () => this.navigateHistory('down'));

    inputRow.appendChild(bar);
    this.historyBar = bar;
    this.updateHistoryBar();
  }

  navigateHistory(direction) {
    if (this.history.length === 0) return;

    if (direction === 'up') {
      if (this.historyIndex < this.history.length - 1) {
        this.historyIndex++;
        this.applyHistoryItem(this.historyIndex);
      }
    } else {
      if (this.historyIndex > 0) {
        this.historyIndex--;
        this.applyHistoryItem(this.historyIndex);
      } else if (this.historyIndex === 0) {
        this.historyIndex = -1;
        this.setInputValue('');
        this.updateHistoryBar();
      }
    }
  }

  updateHistoryBar() {
    const counter = document.querySelector('#bd-history-counter');
    const prevBtn = document.querySelector('#bd-history-prev');
    const nextBtn = document.querySelector('#bd-history-next');
    if (!counter) return;

    if (this.historyIndex === -1) {
      counter.textContent = `${this.history.length}`;
    } else {
      counter.textContent = `${this.historyIndex + 1}/${this.history.length}`;
    }

    // Dim buttons when at the boundary
    if (prevBtn) {
      prevBtn.style.opacity = (this.historyIndex >= this.history.length - 1) ? '0.3' : '1';
    }
    if (nextBtn) {
      nextBtn.style.opacity = (this.historyIndex <= -1) ? '0.3' : '1';
    }
  }

  removeHistoryBar() {
    const bar = document.querySelector('#bd-history-bar');
    if (bar) bar.remove();
    this.historyBar = null;
  }
}

if (typeof window !== 'undefined') {
  window.InputHistoryFeature = InputHistoryFeature;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = InputHistoryFeature;
}
