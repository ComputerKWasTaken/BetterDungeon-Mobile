const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const assetsRoot = path.join(projectRoot, 'app', 'src', 'main', 'assets', 'betterdungeon');

function readAsset(relativePath) {
  return fs.readFileSync(path.join(assetsRoot, relativePath), 'utf8');
}

test('mobile settings expose only the streamlined Custom Dynamic controls', () => {
  const html = readAsset('popup.html');
  const router = readAsset(path.join('services', 'custom-dynamic-router.js'));

  assert.match(html, /id="custom-dynamic-turn-interval"/);
  assert.match(html, /id="custom-dynamic-refresh-models"/);
  assert.match(html, />Version</);
  assert.doesNotMatch(html, /custom-dynamic-routing-mode/);
  assert.doesNotMatch(html, /custom-dynamic-switch-mode/);
  assert.doesNotMatch(html, /custom-dynamic-fail-open/);
  assert.doesNotMatch(router, /applyDomSwitch|adapter-learned|generationUrlPatterns|modelPaths/);
});

test('mobile packages the Better Dynamic routed-model indicator', () => {
  const feature = readAsset(path.join('features', 'custom_dynamic_feature.js'));
  const router = readAsset(path.join('services', 'custom-dynamic-router.js'));
  const polyfill = readAsset(path.join('utils', 'webview-polyfill.js'));
  const logoPath = path.join(assetsRoot, 'icons', 'better-dynamic-logo.png');

  assert.ok(fs.statSync(logoPath).size > 0);
  assert.match(feature, /indicatorLogoUrl:\s*this\.getExtensionAssetUrl\('icons\/better-dynamic-logo\.png'\)/);
  assert.match(router, /data-bd-custom-dynamic-model-image/);
  assert.match(router, /Last routed:/);
  assert.match(router, /\^data:image\\\//);
  assert.match(polyfill, /getAssetDataUri/);
});

test('model discovery preserves server family identity and strips legacy state', () => {
  const sandbox = { window: {}, console, setTimeout, clearTimeout };
  vm.createContext(sandbox);
  vm.runInContext(readAsset(path.join('features', 'custom_dynamic_feature.js')), sandbox);
  const feature = new sandbox.window.CustomDynamicFeature();

  const normalized = [
    feature.normalizeVisibleVersion({
      type: 'text',
      versionName: 'dynamic-small-current',
      available: true,
      aiDetails: {
        title: 'Dynamic Small',
        versionTitle: '1.0.0',
        engineOrder: 1,
        versionOrder: 1
      },
      engineNameEngine: { engineName: 'dynamic-small' }
    }),
    feature.normalizeVisibleVersion({
      type: 'text',
      versionName: 'deepseek-v4-pro',
      available: true,
      aiDetails: {
        title: 'DeepSeek V4 Pro',
        versionTitle: '1.0.0',
        engineOrder: 9,
        versionOrder: 2
      },
      engineNameEngine: { engineName: 'dynamic-small' }
    })
  ];

  const family = feature.harmonizeModelFamilies(normalized);
  assert.deepEqual(
    family.map((version) => [version.modelId, version.modelTitle, version.versionName]),
    [
      ['dynamic-small', 'Dynamic Small', 'dynamic-small-current'],
      ['dynamic-small', 'Dynamic Small', 'deepseek-v4-pro']
    ]
  );

  const currentRuntime = feature.normalizeRuntime({
    visibleVersionsSchemaVersion: 2,
    visibleVersions: family,
    visibleVersionsRefreshedAt: '2026-07-24T00:00:00.000Z',
    adapter: { obsolete: true },
    logs: [{ message: 'obsolete' }],
    lastMechanism: 'ui'
  });
  assert.equal(currentRuntime.visibleVersions.length, 2);
  assert.equal('adapter' in currentRuntime, false);
  assert.equal('logs' in currentRuntime, false);
  assert.equal('lastMechanism' in currentRuntime, false);

  const staleRuntime = feature.normalizeRuntime({
    visibleVersions: family,
    visibleVersionsRefreshedAt: '2026-07-24T00:00:00.000Z'
  });
  assert.equal(staleRuntime.visibleVersions.length, 0);

  const config = feature.normalizeConfig({
    routingMode: 'round-robin',
    switchMode: 'ui',
    failOpen: false,
    debug: true,
    generationUrlPatterns: ['obsolete'],
    modelPaths: ['variables.model'],
    turnInterval: 7,
    pool: [{ modelId: 'dynamic-small', versionName: 'deepseek-v4-pro', weight: 2 }]
  });
  assert.equal(config.turnInterval, 7);
  assert.equal(config.pool[0].versionName, 'deepseek-v4-pro');
  for (const legacyKey of ['routingMode', 'switchMode', 'failOpen', 'debug', 'generationUrlPatterns', 'modelPaths']) {
    assert.equal(legacyKey in config, false);
  }
});

test('shared display versions cannot remap a saved model family', () => {
  const document = {
    addEventListener() {},
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
  const sandbox = {
    window: { addEventListener() {}, location: { href: '' } },
    document,
    chrome: {
      runtime: { onMessage: { addListener() {} } },
      storage: {
        sync: { get() {}, set() {} },
        local: { get() {}, set() {} }
      },
      tabs: { query() {}, create() {} }
    },
    console,
    navigator: {},
    requestAnimationFrame() {},
    setTimeout,
    clearTimeout
  };
  vm.createContext(sandbox);
  vm.runInContext(readAsset('popup.js'), sandbox);

  const result = vm.runInContext(`
    currentCustomDynamicRuntime = normalizeCustomDynamicRuntime({
      visibleVersionsSchemaVersion: CUSTOM_DYNAMIC_CATALOG_SCHEMA_VERSION,
      visibleVersions: [
        {
          modelId: 'dynamic-small',
          modelTitle: 'Dynamic Small',
          versionName: 'dynamic-small-v1',
          versionTitle: '1.0.0',
          aliases: ['Dynamic Small', '1.0.0'],
          available: true
        },
        {
          modelId: 'deepseek-v4-pro',
          modelTitle: 'DeepSeek V4 Pro',
          versionName: 'deepseek-v4-pro-v1',
          versionTitle: '1.0.0',
          aliases: ['DeepSeek V4 Pro', '1.0.0'],
          available: true
        },
        {
          modelId: 'wayfarer-small-2',
          modelTitle: 'Wayfarer Small 2',
          versionName: 'wayfarer-small-v2',
          versionTitle: '2.0.0',
          aliases: ['Wayfarer Small 2', '2.0.0'],
          available: true
        }
      ]
    });
    resolveCustomDynamicPoolModel({
      modelId: 'DeepSeek V4 Pro',
      label: 'DeepSeek V4 Pro',
      versionName: '1.0.0',
      versionLabel: '1.0.0',
      weight: 1
    });
  `, sandbox);

  assert.equal(result.modelId, 'deepseek-v4-pro');
  assert.equal(result.versionName, 'deepseek-v4-pro-v1');
  assert.equal(result.label, 'DeepSeek V4 Pro');
});

test('router keeps weighted cadence, switches exact versions, and fails open', async () => {
  let messageListener = null;
  let switchSucceeds = true;
  const postedMessages = [];
  const nativeRequests = [];
  const randomValues = [0.1, 0.9];
  const sandboxMath = Object.create(Math);
  sandboxMath.random = () => randomValues.shift() ?? 0.1;

  class MockXHR {
    open() {}
    send() {}
  }

  const window = {
    location: {
      href: 'https://play.aidungeon.com/adventure/test',
      origin: 'https://play.aidungeon.com'
    },
    XMLHttpRequest: MockXHR,
    fetch: async (input, init) => {
      nativeRequests.push({ input, init });
      return { ok: true, status: 200 };
    },
    addEventListener(type, listener) {
      if (type === 'message') messageListener = listener;
    },
    postMessage(message) {
      postedMessages.push(message);
      if (message.type !== 'switch-model') return;
      Promise.resolve().then(() => {
        messageListener({
          source: window,
          origin: window.location.origin,
          data: {
            namespace: message.namespace,
            direction: 'extension-to-page',
            type: 'switch-model-result',
            payload: {
              requestId: message.payload.requestId,
              success: switchSucceeds,
              mechanism: 'graphql-settings'
            }
          }
        });
      });
    }
  };
  const routerConsole = Object.create(console);
  routerConsole.warn = () => {};
  routerConsole.error = () => {};
  const sandbox = {
    console: routerConsole,
    window,
    Math: sandboxMath,
    Headers,
    Request,
    URL,
    URLSearchParams,
    queueMicrotask,
    setTimeout,
    clearTimeout,
    structuredClone
  };

  vm.runInNewContext(readAsset(path.join('services', 'custom-dynamic-router.js')), sandbox);

  const sendState = (config, runtime) => {
    messageListener({
      source: window,
      origin: window.location.origin,
      data: {
        namespace: 'betterdungeon-custom-dynamic-v1',
        direction: 'extension-to-page',
        type: 'state',
        payload: {
          config,
          runtime,
          indicatorLogoUrl: 'data:image/png;base64,AA=='
        }
      }
    });
  };

  sendState({
    enabled: true,
    turnInterval: 2,
    pool: [
      { enabled: true, modelId: 'glm', label: 'GLM', versionName: 'glm-5-2', weight: 1 },
      { enabled: true, modelId: 'deepseek', label: 'DeepSeek', versionName: 'deepseek-v4', weight: 1 }
    ]
  }, {});

  const generation = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      operationName: 'TakeAction',
      variables: { input: 'Continue', storyAiVersionName: 'old-version' }
    })
  };
  await window.fetch('https://api.aidungeon.com/graphql', generation);
  await window.fetch('https://api.aidungeon.com/graphql', generation);
  await window.fetch('https://api.aidungeon.com/graphql', generation);

  const switches = postedMessages.filter((message) => message.type === 'switch-model');
  assert.deepEqual(switches.map((message) => message.payload.versionName), ['glm-5-2', 'deepseek-v4']);

  const selectionEvents = postedMessages
    .filter((message) => message.type === 'runtime-event' && message.payload.kind === 'selection-state')
    .map((message) => message.payload);
  assert.deepEqual(selectionEvents.map((event) => event.turnsOnModel), [1, 2, 1]);
  assert.deepEqual(selectionEvents.map((event) => event.versionName), [
    'glm-5-2',
    'glm-5-2',
    'deepseek-v4'
  ]);
  assert.deepEqual(
    nativeRequests.map((request) => JSON.parse(request.init.body).variables.storyAiVersionName),
    ['glm-5-2', 'glm-5-2', 'deepseek-v4']
  );

  switchSucceeds = false;
  sendState({
    enabled: true,
    turnInterval: 1,
    pool: [{ enabled: true, modelId: 'fable', label: 'Fable', versionName: 'fable-v1', weight: 1 }]
  }, {
    lastModelId: 'not-fable',
    lastVersionName: 'not-fable',
    turnsOnModel: 0
  });

  const eventsBeforeFallback = postedMessages.filter((message) => message.type === 'runtime-event').length;
  await window.fetch('https://api.aidungeon.com/graphql', generation);
  assert.equal(JSON.parse(nativeRequests.at(-1).init.body).variables.storyAiVersionName, 'fable-v1');
  assert.equal(
    postedMessages.filter((message) => message.type === 'runtime-event').length,
    eventsBeforeFallback + 1
  );

  sendState({
    enabled: true,
    turnInterval: 1,
    pool: [{ enabled: true, modelId: 'fable', label: 'Fable', versionName: 'fable-v1', weight: 1 }]
  }, {
    lastModelId: 'not-fable',
    lastVersionName: 'not-fable',
    turnsOnModel: 0
  });
  const noModelField = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      operationName: 'TakeAction',
      variables: { input: 'Continue' }
    })
  };
  const eventsBeforeFailOpen = postedMessages.filter((message) => message.type === 'runtime-event').length;
  await window.fetch('https://api.aidungeon.com/graphql', noModelField);
  assert.deepEqual(JSON.parse(nativeRequests.at(-1).init.body), JSON.parse(noModelField.body));
  assert.equal(
    postedMessages.filter((message) => message.type === 'runtime-event').length,
    eventsBeforeFailOpen
  );
});

test('the Android popup bridge correlates concurrent responses', () => {
  const activity = fs.readFileSync(
    path.join(projectRoot, 'app', 'src', 'main', 'java', 'com', 'computerk', 'betterdungeon', 'MainActivity.kt'),
    'utf8'
  );
  const bridge = fs.readFileSync(
    path.join(projectRoot, 'app', 'src', 'main', 'java', 'com', 'computerk', 'betterdungeon', 'BetterDungeonBridge.kt'),
    'utf8'
  );
  const polyfill = readAsset(path.join('utils', 'webview-polyfill.js'));

  assert.match(activity, /__bdPopupCallbacks/);
  assert.match(activity, /forwardToMainWebView\(messageJson, requestId\)/);
  assert.match(activity, /betterdungeon:popup-bridge-ready/);
  assert.match(bridge, /fun forwardToMainWebView\(messageJson: String, requestId: String\)/);
  assert.match(bridge, /fun sendResponseToPopup\(responseJson: String, requestId: String\)/);
  assert.match(polyfill, /__bdDispatchMessageFromPopup = function \(message, requestId\)/);
  assert.match(polyfill, /JSON\.stringify\(response\),\s+requestId/);
});
