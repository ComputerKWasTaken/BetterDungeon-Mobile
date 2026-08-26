'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'app', 'src', 'main', 'assets', 'betterdungeon');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function classList() {
  const values = new Set();
  return {
    add(...names) { names.forEach(name => values.add(name)); },
    remove(...names) { names.forEach(name => values.delete(name)); },
    contains(name) { return values.has(name); },
    toggle(name, force) {
      const enabled = force === undefined ? !values.has(name) : !!force;
      if (enabled) values.add(name);
      else values.delete(name);
      return enabled;
    },
  };
}

function styleStore() {
  const values = new Map();
  return {
    width: '',
    left: '',
    top: '',
    right: '',
    bottom: '',
    setProperty(name, value) { values.set(name, value); },
    getPropertyValue(name) { return values.get(name) || ''; },
  };
}

function element() {
  return {
    children: [],
    className: '',
    textContent: '',
    append(...children) { this.children.push(...children); },
    appendChild(child) { this.children.push(child); },
    setAttribute() {},
  };
}

function testStaticMobileContracts() {
  const feature = read('app/src/main/assets/betterdungeon/features/navigator_feature.js');
  const session = read('app/src/main/assets/betterdungeon/services/navigator/session.js');
  const styles = read('app/src/main/assets/betterdungeon/styles.css');
  const theme = read('app/src/main/assets/betterdungeon/core/theme-variables.css');
  const popupHtml = read('app/src/main/assets/betterdungeon/popup.html');
  const popupJs = read('app/src/main/assets/betterdungeon/popup.js');
  const mainJs = read('app/src/main/assets/betterdungeon/main.js');
  const activity = read('app/src/main/java/com/computerk/betterdungeon/MainActivity.kt');

  assert.match(styles, /\.bd-navigator-settings-native-hidden\s*\{/);
  assert.match(styles, /\.bd-navigator-settings-content\s*\{/);
  assert.match(styles, /\.bd-navigator-drawer\.bd-navigator-embedded\s*\{/);
  assert.match(styles, /#keyboard-field-reveal-scroll-surface-settings-gameplay\.bd-navigator-settings-active/);
  assert.match(styles, /\.bd-navigator-settings-surface\.bd-navigator-settings-active/);
  assert.match(styles, /bd-navigator-secondary-open/);
  assert.match(styles, /\.bd-navigator-drawer\.bd-navigator-sheet\s*\{/);
  assert.match(styles, /--bd-navigator-viewport-height/);
  assert.match(styles, /body\.bd-navigator-open/);
  assert.match(styles, /font-size:\s*16px/);
  assert.match(styles, /@media \(max-width:\s*480px\)/);
  assert.match(styles, /min-height:\s*44px/);
  assert.match(styles, /\.bd-navigator-proposal-refresh[\s\S]*text-decoration: underline/);
  assert.match(styles, /\.bd-navigator-proposal-value pre \{[\s\S]*display: block;[\s\S]*min-width: 0;[\s\S]*max-width: 100%/);
  assert.doesNotMatch(styles, /\.bd-navigator-markdown code \{[\s\S]*box-decoration-break: clone/);

  const navigatorCss = styles.slice(styles.indexOf('NAVIGATOR\n'));
  const tokenReferences = new Set(
    Array.from(navigatorCss.matchAll(/var\((--bd-[a-z0-9-]+)/gi), match => match[1])
  );
  const tokenDefinitions = new Set(
    Array.from(`${theme}\n${styles}`.matchAll(/(--bd-[a-z0-9-]+)\s*:/gi), match => match[1])
  );
  const runtimeViewportTokens = new Set([
    '--bd-navigator-viewport-top',
    '--bd-navigator-viewport-left',
    '--bd-navigator-viewport-width',
    '--bd-navigator-viewport-height',
  ]);
  const missingTokens = Array.from(tokenReferences)
    .filter(token => !tokenDefinitions.has(token) && !runtimeViewportTokens.has(token));
  assert.deepEqual(missingTokens, [], `undefined Navigator design tokens: ${missingTokens.join(', ')}`);

  assert.match(feature, /shouldUseSheet\(\)\s*\{\s*return true;/);
  assert.match(feature, /this\.useSettingsPanel = true/);
  assert.match(feature, /GAMEPLAY_SETTINGS_SURFACE_ID = 'keyboard-field-reveal-scroll-surface-settings-gameplay'/);
  assert.match(feature, /\[role="tablist"\]\[aria-label="Section Tabs" i\]/);
  assert.match(feature, /setAttribute\('role', 'complementary'\)/);
  assert.doesNotMatch(feature, /setAttribute\('aria-modal', 'true'\)/);
  assert.match(feature, /createSettingsTab\(tablist, modelsTab\)/);
  assert.match(feature, /insertBefore\(wrapper, modelsTab\.parentElement\)/);
  assert.match(feature, /activateSettingsNavigator\(\{ focus: false \}\)/);
  assert.match(feature, /syncSettingsIntegration\(\)/);
  assert.match(feature, /scheduleSettingsIntegrationSync\(\)/);
  assert.match(feature, /this\.scheduleSettingsIntegrationSync\(\);\s*if \(this\.detectionDebounce\)/);
  assert.match(feature, /classList\?\.contains\('is_ScrollView'\)/);
  assert.match(feature, /bd-navigator-settings-surface/);
  assert.match(feature, /aria-controls', 'bd-navigator-settings-content'/);
  assert.doesNotMatch(feature, /\[NavigatorDebug\]/);
  assert.match(feature, /bd-navigator-settings-native-hidden/);
  assert.match(feature, /compositionstart/);
  assert.match(feature, /event\.isComposing/);
  assert.doesNotMatch(feature, /activateSettingsNavigator\(\{ focus: true \}\)/);
  assert.match(feature, /window\.__bdNavigatorHandleBack/);
  assert.doesNotMatch(feature, /aria-label="Close Navigator"/);
  assert.doesNotMatch(feature, /event\.altKey[\s\S]*event\.key\?\.toLowerCase\(\) === 'n'/);
  assert.match(feature, /async refreshPermissionState\(\)/);
  assert.equal((feature.match(/<input[^>]*data-nav-setting="/g) || []).length, 2);
  assert.match(feature, /input type="range"[\s\S]*data-nav-setting="thinkingLevel"/);
  assert.match(feature, /input type="checkbox" data-nav-setting="readOnly"/);
  assert.match(feature, /fieldset class="bd-navigator-context-sections"/);
  assert.match(feature, /data-nav-context-section="plot"[\s\S]*data-nav-context-section="history"[\s\S]*data-nav-context-section="memory"[\s\S]*data-nav-context-section="cards"/);
  assert.doesNotMatch(feature, /fieldset[^>]*data-nav-setting="contextSections"/);
  assert.match(feature, /updateThinkingLevelLabel\(Number\(event\.target\.value\)\)/);
  assert.match(feature, /thinking\.disabled = supported\.length === 0/);
  assert.doesNotMatch(feature, /includeMemoryBank|historyMode|Inherit global default/);

  assert.match(session, /setReadOnlyMode\(enabled\)/);
  assert.match(session, /changes\?\.\[READ_ONLY_STORAGE_KEY\]/);
  assert.match(session, /NAVIGATOR_ADVENTURE_SETTINGS_PREFIX/);

  assert.equal((popupHtml.match(/id="feature-navigator"/g) || []).length, 1);
  for (const id of ['navigator-read-only', 'navigator-thinking-level', 'navigator-memory-bank', 'navigator-history-mode']) {
    assert.equal((popupHtml.match(new RegExp(`id="${id}"`, 'g')) || []).length, 0);
    assert.doesNotMatch(popupJs, new RegExp(id));
  }
  assert.match(popupHtml, /Game Menu &gt; Gameplay &gt; Navigator/);
  assert.doesNotMatch(popupHtml, /full-screen sheet/);
  assert.match(popupHtml, /never writes without direct approval/i);
  assert.doesNotMatch(popupJs, /betterDungeon_navigator_(read_only|thinking_level|defaults)/);

  assert.doesNotMatch(mainJs, /SET_NAVIGATOR_READ_ONLY|handleRefreshNavigatorPermissions/);

  const backHandler = activity.slice(activity.indexOf('private fun setupBackNavigation()'));
  const popupPriority = backHandler.indexOf('popupContainer.visibility == View.VISIBLE');
  const pendingGuard = backHandler.indexOf('if (backNavigationPending) return');
  const navigatorDispatch = backHandler.indexOf('window.__bdNavigatorHandleBack');
  const webViewFallback = backHandler.indexOf('mainWebView.canGoBack()');
  assert.ok(popupPriority >= 0 && popupPriority < pendingGuard);
  assert.ok(pendingGuard < navigatorDispatch && navigatorDispatch < webViewFallback);
  assert.match(backHandler, /result\.trim\(\)\.equals\("true", ignoreCase = true\)/);
  assert.match(activity, /override fun onConsoleMessage\(consoleMessage: ConsoleMessage\)/);
  assert.match(activity, /"BDWebView"/);
}

async function testFeatureRuntimeContracts() {
  global.window = global;
  global.innerWidth = 1000;
  global.innerHeight = 800;
  global.visualViewport = { offsetLeft: 0, offsetTop: 0, width: 1000, height: 800 };
  let closeSettingsCalls = 0;
  global.document = {
    activeElement: null,
    body: { classList: classList() },
    createElement: element,
    querySelector(selector) {
      return selector === '[aria-label="Close settings"]'
        ? { click() { closeSettingsCalls += 1; } }
        : null;
    },
  };

  const filename = path.join(ASSETS, 'features', 'navigator_feature.js');
  vm.runInThisContext(fs.readFileSync(filename, 'utf8'), { filename });
  const feature = new window.NavigatorFeature();
  const drawerClasses = classList();
  const launcherClasses = classList();
  let focusCalls = 0;
  let blurCalls = 0;
  feature.drawer = {
    hidden: true,
    classList: drawerClasses,
    style: styleStore(),
  };
  feature.launcher = {
    classList: launcherClasses,
    style: styleStore(),
    getBoundingClientRect: () => ({ left: 900, top: 700, width: 44, height: 44 }),
  };
  feature.inputEl = {
    focus() { focusCalls += 1; },
    blur() { blurCalls += 1; },
  };
  feature.session = { isChatBusy: false };
  feature.updateSubtitle = () => {};
  feature.scrollToBottom = () => {};

  const memoryActivity = feature.createToolActivityIndicator(['search_memory_bank'], true);
  assert.equal(memoryActivity.children[1].textContent, 'Searched Memory Bank');
  assert.equal(memoryActivity.children[0].className, 'icon-search');
  const historyActivity = feature.createToolActivityIndicator(['get_story_actions'], true);
  assert.equal(historyActivity.children[1].textContent, 'Read story actions');
  assert.equal(historyActivity.children[0].className, 'icon-wand-sparkles');
  const mixedActivity = feature.createToolActivityIndicator(['search_story_cards', 'search_memory_bank'], true);
  assert.equal(mixedActivity.children[1].textContent, 'Used 2 Navigator read tools');

  assert.equal(feature.shouldUseSheet(), true);
  let activationFocus = null;
  feature.syncSettingsIntegration = () => true;
  feature.applyActiveSettingsView = ({ focus }) => { activationFocus = focus; };
  assert.equal(feature.activateSettingsNavigator({ focus: false }), true);
  assert.equal(feature.isOpen, true);
  assert.equal(feature.settingsTabActive, true);
  assert.equal(activationFocus, false);
  assert.equal(focusCalls, 0, 'opening Navigator from the settings tab must not summon the IME');

  feature.settingsSurface = {
    classList: classList(),
    getBoundingClientRect: () => ({ bottom: 700 }),
  };
  feature.settingsContentPanel = {
    hidden: false,
    style: {},
    getBoundingClientRect: () => ({ top: 200 }),
  };
  drawerClasses.add('bd-navigator-embedded');
  feature.syncVisualViewport();
  assert.equal(feature.drawer.style.getPropertyValue('--bd-navigator-viewport-height'), '800px');
  assert.equal(feature.drawer.style.height, '500px');
  assert.equal(feature.settingsContentPanel.style.height, '500px');

  feature.installAndroidBackHandler();
  assert.equal(window.__bdNavigatorHandleBack(), true);
  assert.equal(feature.isOpen, false);
  assert.equal(feature.drawer.hidden, true);
  assert.equal(blurCalls, 1);
  assert.equal(closeSettingsCalls, 1);
  assert.equal(window.__bdNavigatorHandleBack(), false);
  feature.uninstallAndroidBackHandler();
  assert.equal(window.__bdNavigatorHandleBack, undefined);

  let loaded = 0;
  let refreshed = 0;
  feature.session = {
    loadReadOnlyMode: async () => { loaded += 1; },
    getPermissionState: () => ({ readOnly: true }),
  };
  feature.updatePermissionUI = () => { refreshed += 1; };
  feature.renderAllProposalStates = () => { refreshed += 1; };
  feature.updateComposerState = () => { refreshed += 1; };
  const state = await feature.refreshPermissionState();
  assert.deepEqual(state, { readOnly: true, available: true });
  assert.equal(loaded, 1);
  assert.equal(refreshed, 3);
}

async function main() {
  testStaticMobileContracts();
  await testFeatureRuntimeContracts();
  console.log('Navigator Phase 4 Mobile contract tests passed');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
