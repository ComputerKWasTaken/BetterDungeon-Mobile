// BetterDungeon - Navigator settings shell
// Presentation-only integration for Settings > Gameplay. Adventure context,
// AI requests, persistence, proposals, and mutations intentionally live outside
// this first design pass.

class NavigatorFeature {
  static id = 'navigator';

  constructor() {
    this.debug = false;
    this.observer = null;
    this.reconcileTimer = null;
    this.tabItem = null;
    this.tab = null;
    this.tabParent = null;
    this.pane = null;
    this.active = false;
    this.view = 'chat';
    this.nativeBindings = new Map();
    this.nativeState = new Map();
    this.boundResize = () => this.positionPane();
    this.boundViewportChange = () => this.positionPane();
  }

  log(...args) {
    if (this.debug) console.log('[NavigatorShell]', ...args);
  }

  init() {
    this.observer = new MutationObserver(() => this.scheduleReconcile());
    if (document.body) this.observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', this.boundResize, { passive: true });
    window.visualViewport?.addEventListener('resize', this.boundViewportChange, { passive: true });
    window.visualViewport?.addEventListener('scroll', this.boundViewportChange, { passive: true });
    this.reconcile();
  }

  destroy() {
    this.observer?.disconnect();
    this.observer = null;
    if (this.reconcileTimer) clearTimeout(this.reconcileTimer);
    this.reconcileTimer = null;
    window.removeEventListener('resize', this.boundResize);
    window.visualViewport?.removeEventListener('resize', this.boundViewportChange);
    window.visualViewport?.removeEventListener('scroll', this.boundViewportChange);
    this.deactivate();
    this.tabItem?.remove();
    this.tabItem = null;
    this.tab = null;
    this.tabParent = null;
    for (const [tab, listener] of this.nativeBindings) tab.removeEventListener('click', listener);
    this.nativeBindings.clear();
    this.nativeState.clear();
  }

  scheduleReconcile() {
    if (this.reconcileTimer) clearTimeout(this.reconcileTimer);
    this.reconcileTimer = setTimeout(() => {
      this.reconcileTimer = null;
      this.reconcile();
    }, 60);
  }

  tabLabel(tab) {
    const aria = String(tab?.getAttribute?.('aria-label') || '')
      .replace(/^selected\s+tab\s+/i, '')
      .replace(/^tab\s+/i, '')
      .trim();
    return (aria || tab?.textContent || '').trim().toLowerCase();
  }

  findNativeTab(label) {
    const target = String(label).toLowerCase();
    const matches = [...document.querySelectorAll('[role="tab"]')]
      .filter(tab => !tab.closest('[data-bd-navigator-tab-item]'))
      .filter(tab => this.tabLabel(tab) === target);
    return matches.find(tab => tab.getClientRects().length && !tab.closest('[aria-hidden="true"]')) || matches[0] || null;
  }

  lowestCommonAncestor(left, right) {
    if (!left || !right) return null;
    const ancestors = new Set();
    for (let node = left; node; node = node.parentElement) ancestors.add(node);
    for (let node = right; node; node = node.parentElement) {
      if (ancestors.has(node)) return node;
    }
    return null;
  }

  directChildUnder(node, parent) {
    let child = node;
    while (child?.parentElement && child.parentElement !== parent) child = child.parentElement;
    return child?.parentElement === parent ? child : null;
  }

  reconcile() {
    const aiModels = this.findNativeTab('ai models');
    const appearance = this.findNativeTab('appearance');
    const parent = this.lowestCommonAncestor(aiModels, appearance);
    const aiItem = this.directChildUnder(aiModels, parent);
    const appearanceItem = this.directChildUnder(appearance, parent);

    if (!aiModels || !appearance || !parent || !aiItem || !appearanceItem || aiItem === appearanceItem) {
      if (this.active) this.deactivate();
      this.tabItem?.remove();
      this.tabItem = null;
      this.tab = null;
      this.tabParent = null;
      return;
    }

    this.bindNativeTab(aiModels);
    this.bindNativeTab(appearance);

    if (!this.tabItem?.isConnected || this.tabParent !== parent) {
      this.tabItem?.remove();
      const created = this.createNavigatorTab(appearanceItem);
      parent.insertBefore(created.item, aiItem);
      this.tabItem = created.item;
      this.tab = created.tab;
      this.tabParent = parent;
    }

    if (this.active) {
      this.setNavigatorTabState(true);
      this.setNativeTabsInactive([aiModels, appearance], true);
      this.ensurePane();
      this.positionPane();
    }
  }

  createNavigatorTab(templateItem) {
    const item = templateItem.cloneNode(true);
    item.setAttribute('data-bd-navigator-tab-item', 'true');
    for (const node of [item, ...item.querySelectorAll('*')]) {
      node.removeAttribute('id');
      node.removeAttribute('aria-labelledby');
      node.removeAttribute('data-state');
    }

    let tab = item.matches?.('[role="tab"]') ? item : item.querySelector('[role="tab"]');
    if (!tab) {
      tab = document.createElement('button');
      tab.type = 'button';
      tab.setAttribute('role', 'tab');
      item.replaceChildren(tab);
    }
    tab.classList.add('bd-navigator-settings-tab');
    tab.setAttribute('aria-label', 'Tab Navigator');
    tab.setAttribute('aria-selected', 'false');
    tab.setAttribute('tabindex', '0');
    tab.removeAttribute('aria-controls');

    const icon = document.createElement('span');
    icon.className = 'bd-navigator-settings-tab-icon bd-navigator-logo-mark icon-compass';
    icon.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'bd-navigator-settings-tab-label font_body _ff-f-family';
    label.textContent = 'Navigator';
    tab.replaceChildren(icon, label);
    tab.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      this.activate();
    });
    tab.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.activate();
      }
    });
    return { item, tab };
  }

  bindNativeTab(tab) {
    if (!tab || this.nativeBindings.has(tab)) return;
    const listener = () => {
      if (this.active) this.deactivate();
    };
    tab.addEventListener('click', listener);
    this.nativeBindings.set(tab, listener);
  }

  activate() {
    if (this.active) return;
    this.active = true;
    this.setNavigatorTabState(true);
    this.setNativeTabsInactive([
      this.findNativeTab('ai models'),
      this.findNativeTab('appearance'),
    ], true);
    this.ensurePane();
    this.renderPane();
    this.positionPane();
    this.pane?.querySelector('.bd-navigator-design-composer textarea')?.focus({ preventScroll: true });
  }

  deactivate() {
    this.active = false;
    this.setNavigatorTabState(false);
    this.restoreNativeTabs();
    this.pane?.remove();
    this.pane = null;
  }

  setNavigatorTabState(active) {
    if (!this.tab) return;
    this.tab.classList.toggle('is-active', active);
    this.tab.setAttribute('aria-selected', active ? 'true' : 'false');
    this.tab.setAttribute('aria-label', active ? 'Selected tab Navigator' : 'Tab Navigator');
    this.tab.setAttribute('data-state', active ? 'active' : 'inactive');
  }

  setNativeTabsInactive(tabs, inactive) {
    for (const tab of tabs.filter(Boolean)) {
      const item = this.directChildUnder(tab, this.tabParent) || tab;
      if (inactive && !this.nativeState.has(tab)) {
        this.nativeState.set(tab, {
          ariaSelected: tab.getAttribute('aria-selected'),
          dataState: tab.getAttribute('data-state'),
          item,
        });
      }
      tab.classList.toggle('bd-navigator-native-tab-inactive', inactive);
      item.classList?.toggle('bd-navigator-native-tab-item-inactive', inactive);
      if (inactive) {
        tab.setAttribute('aria-selected', 'false');
        tab.setAttribute('data-state', 'inactive');
      }
    }
  }

  restoreNativeTabs() {
    for (const [tab, state] of this.nativeState) {
      tab.classList.remove('bd-navigator-native-tab-inactive');
      state.item?.classList?.remove('bd-navigator-native-tab-item-inactive');
      if (state.ariaSelected === null) tab.removeAttribute('aria-selected');
      else tab.setAttribute('aria-selected', state.ariaSelected);
      if (state.dataState === null) tab.removeAttribute('data-state');
      else tab.setAttribute('data-state', state.dataState);
    }
    this.nativeState.clear();
  }

  ensurePane() {
    if (this.pane?.isConnected) return;
    this.pane = document.createElement('section');
    this.pane.className = 'bd-navigator-design-shell font_body _ff-f-family';
    this.pane.setAttribute('aria-label', 'Navigator assistant');
    this.pane.setAttribute('data-bd-navigator-design', 'true');
    document.body.appendChild(this.pane);
    this.renderPane();
  }

  findSettingsRoot() {
    const close = document.querySelector('[aria-label="Close settings"], [aria-label="Close Settings"]');
    const common = this.lowestCommonAncestor(this.tabParent, close);
    return common && common !== document.documentElement ? common : document.body;
  }

  positionPane() {
    if (!this.active || !this.pane?.isConnected || !this.tabParent?.isConnected) return;
    const tabRect = this.tabParent.getBoundingClientRect();
    const root = this.findSettingsRoot();
    const viewport = window.visualViewport;
    const viewportLeft = viewport?.offsetLeft || 0;
    const viewportTop = viewport?.offsetTop || 0;
    const viewportRight = viewportLeft + (viewport?.width || window.innerWidth);
    const viewportBottom = viewportTop + (viewport?.height || window.innerHeight);
    const rootRect = root === document.body
      ? { left: viewportLeft, right: viewportRight, bottom: viewportBottom }
      : root.getBoundingClientRect();
    const left = Math.max(viewportLeft, rootRect.left);
    const right = Math.min(viewportRight, rootRect.right || viewportRight);
    const top = Math.max(viewportTop, tabRect.bottom);
    const bottom = Math.min(viewportBottom, rootRect.bottom || viewportBottom);
    this.pane.style.left = `${Math.round(left)}px`;
    this.pane.style.top = `${Math.round(top)}px`;
    this.pane.style.width = `${Math.max(0, Math.round(right - left))}px`;
    this.pane.style.height = `${Math.max(0, Math.round(bottom - top))}px`;
  }

  make(tag, className, text = null) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== null) element.textContent = text;
    return element;
  }

  icon(name, className = '') {
    const icon = this.make('span', `${className} icon-${name}`.trim());
    icon.setAttribute('aria-hidden', 'true');
    return icon;
  }

  renderPane() {
    if (!this.pane) return;
    this.pane.replaceChildren(this.renderBody());
  }

  renderBody() {
    const body = this.make('div', 'bd-navigator-design-body');
    const navigation = this.make('nav', 'bd-navigator-design-views');
    navigation.setAttribute('aria-label', 'Navigator views');
    for (const [id, label, icon] of [['chat', 'Chat', 'message-circle'], ['history', 'History', 'history']]) {
      const button = this.make('button', `bd-navigator-design-view${this.view === id ? ' is-active' : ''}`);
      button.type = 'button';
      button.setAttribute('aria-pressed', this.view === id ? 'true' : 'false');
      button.append(this.icon(icon), this.make('span', '', label));
      button.addEventListener('click', () => {
        this.view = id;
        this.renderPane();
      });
      navigation.appendChild(button);
    }
    body.appendChild(navigation);
    body.appendChild(this.view === 'history' ? this.renderHistory() : this.renderChat());
    return body;
  }

  renderChat() {
    const home = this.make('main', 'bd-navigator-design-home');
    const panel = this.make('section', 'bd-navigator-design-panel');
    const introduction = this.make('section', 'bd-navigator-design-introduction');
    const art = this.make('div', 'bd-navigator-design-orb');
    art.appendChild(this.icon('compass', 'bd-navigator-logo-mark'));
    const introductionCopy = this.make('div', 'bd-navigator-design-introduction-copy');
    introductionCopy.append(
      this.make('h2', '', 'How can I help?'),
      this.make('p', '', 'Ask about this adventure, explore new directions, or describe something you would like to improve.')
    );
    introduction.append(art, introductionCopy);
    panel.append(introduction, this.renderComposer());

    const prompts = this.make('div', 'bd-navigator-design-prompts');
    const suggestions = [
      ['book-open', 'Review continuity'],
      ['lightbulb', 'Brainstorm the next scene'],
      ['wand-sparkles', 'Refine plot components'],
      ['list-checks', 'Audit Story Cards'],
    ];
    for (const [icon, title] of suggestions) {
      const button = this.make('button', 'bd-navigator-design-prompt');
      button.type = 'button';
      button.append(this.icon(icon), this.make('span', '', title), this.icon('chevron-right', 'bd-navigator-design-prompt-arrow'));
      button.addEventListener('click', () => {
        const input = this.pane?.querySelector('.bd-navigator-design-composer textarea');
        if (input) {
          input.value = title;
          input.focus();
        }
      });
      prompts.appendChild(button);
    }
    panel.appendChild(prompts);
    home.appendChild(panel);
    return home;
  }

  renderComposer() {
    const composer = this.make('footer', 'bd-navigator-design-composer');
    const field = this.make('div', 'bd-navigator-design-composer-field');
    const textarea = this.make('textarea');
    textarea.rows = 2;
    textarea.placeholder = 'Message Navigator…';
    textarea.setAttribute('aria-label', 'Message Navigator');
    const send = this.make('button', 'bd-navigator-design-send');
    send.type = 'button';
    send.disabled = true;
    send.title = 'Assistant functionality comes in the next implementation pass';
    send.setAttribute('aria-label', 'Send message (coming next)');
    send.appendChild(this.icon('send'));
    field.append(textarea, send);
    composer.appendChild(field);
    return composer;
  }

  renderHistory() {
    const history = this.make('main', 'bd-navigator-design-history');
    const icon = this.make('div', 'bd-navigator-design-history-icon');
    icon.appendChild(this.icon('history'));
    history.append(
      icon,
      this.make('h3', '', 'No Navigator history yet'),
      this.make('p', '', 'Applied change batches will appear here with clear outcomes and conflict-safe undo controls.'),
      this.make('span', 'bd-navigator-design-history-note', 'Conversation and change history will remain separate.')
    );
    return history;
  }
}

if (typeof window !== 'undefined') window.NavigatorFeature = NavigatorFeature;
if (typeof module !== 'undefined' && module.exports) module.exports = NavigatorFeature;
