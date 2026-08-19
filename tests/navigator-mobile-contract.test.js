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

function testStaticMobileContracts() {
  const feature = read('app/src/main/assets/betterdungeon/features/navigator_feature.js');
  const session = read('app/src/main/assets/betterdungeon/services/navigator/session.js');
  const styles = read('app/src/main/assets/betterdungeon/styles.css');
  const theme = read('app/src/main/assets/betterdungeon/core/theme-variables.css');
  const popupHtml = read('app/src/main/assets/betterdungeon/popup.html');
  const popupJs = read('app/src/main/assets/betterdungeon/popup.js');
  const mainJs = read('app/src/main/assets/betterdungeon/main.js');
  const activity = read('app/src/main/java/com/computerk/betterdungeon/MainActivity.kt');

  assert.doesNotMatch(styles, /bd-navigator-settings-tab/);
  assert.match(styles, /\.bd-navigator-drawer\.bd-navigator-sheet\s*\{/);
  assert.match(styles, /--bd-navigator-viewport-height/);
  assert.match(styles, /body\.bd-navigator-open/);
  assert.match(styles, /font-size:\s*16px/);
  assert.match(styles, /@media \(max-width:\s*480px\)/);
  assert.match(styles, /min-height:\s*44px/);

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
  assert.match(feature, /setAttribute\('role', 'dialog'\)/);
  assert.match(feature, /setAttribute\('aria-modal', 'true'\)/);
  assert.match(feature, /compositionstart/);
  assert.match(feature, /event\.isComposing/);
  assert.doesNotMatch(feature, /this\.inputEl\?\.focus\(\)/);
  assert.match(feature, /window\.__bdNavigatorHandleBack/);
  assert.match(feature, /document\.body\.classList\.add\('bd-navigator-open'\)/);
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
  assert.match(popupHtml, /full-screen sheet/);
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
}

async function testFeatureRuntimeContracts() {
  global.window = global;
  global.innerWidth = 1000;
  global.innerHeight = 800;
  global.visualViewport = { offsetLeft: 0, offsetTop: 0, width: 1000, height: 800 };
  global.document = {
    activeElement: null,
    body: { classList: classList() },
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

  assert.equal(feature.shouldUseSheet(), true);
  feature.openDrawer();
  assert.equal(feature.isOpen, true);
  assert.equal(feature.drawer.hidden, false);
  assert.equal(focusCalls, 0, 'opening Navigator must not summon the IME');
  assert.equal(document.body.classList.contains('bd-navigator-open'), true);
  assert.equal(drawerClasses.contains('bd-navigator-sheet'), true);
  assert.equal(feature.drawer.style.getPropertyValue('--bd-navigator-viewport-height'), '800px');

  feature.installAndroidBackHandler();
  assert.equal(window.__bdNavigatorHandleBack(), true);
  assert.equal(feature.isOpen, false);
  assert.equal(feature.drawer.hidden, true);
  assert.equal(document.body.classList.contains('bd-navigator-open'), false);
  assert.equal(blurCalls, 1);
  assert.equal(window.__bdNavigatorHandleBack(), false);
  feature.uninstallAndroidBackHandler();
  assert.equal(window.__bdNavigatorHandleBack, undefined);

  feature.launcherPosition = { x: 900, y: 700 };
  global.visualViewport = { offsetLeft: 10, offsetTop: 20, width: 300, height: 400 };
  feature.applyLauncherPosition();
  assert.equal(feature.launcher.style.left, '254px');
  assert.equal(feature.launcher.style.top, '364px');
  assert.deepEqual(feature.launcherPosition, { x: 900, y: 700 }, 'IME clamping must not overwrite saved coordinates');

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
