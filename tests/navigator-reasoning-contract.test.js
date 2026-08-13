const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', 'app', 'src', 'main', 'assets', 'betterdungeon');
const settingsSource = fs.readFileSync(path.join(root, 'services/navigator/settings.js'), 'utf8');
const mutationsSource = fs.readFileSync(path.join(root, 'services/navigator/mutations.js'), 'utf8');
const executorSource = fs.readFileSync(path.join(root, 'modules/ai/executor.js'), 'utf8');
const runtimeSource = fs.readFileSync(path.join(root, 'utils/ai-native-runtime.js'), 'utf8');

let syncStore = {
  betterDungeon_navigator_read_only: true,
  betterDungeon_navigator_settings: {
    version: 99,
    readOnly: false,
    thinkingLevel: 'bogus',
    sendReasoningToCustom: 'yes',
    unknown: true,
  },
};

function makeContext(storage = true) {
  const listeners = [];
  const context = {
    console,
    setTimeout,
    clearTimeout,
    window: {},
    chrome: {
      runtime: { id: 'navigator-reasoning-contract' },
      storage: {
        sync: storage ? {
          get(keys, callback) {
            const requested = Array.isArray(keys) ? keys : [keys];
            callback(Object.fromEntries(requested.map(key => [key, syncStore[key]])));
          },
          set(values, callback) {
            syncStore = { ...syncStore, ...values };
            callback?.();
          },
        } : { get() {} },
        onChanged: { addListener(listener) { listeners.push(listener); } },
      },
    },
  };
  vm.createContext(context);
  return context;
}

(async () => {
  const context = makeContext();
  vm.runInContext(settingsSource, context);
  const settings = await context.window.NavigatorSettings.load();
  assert.equal(settings.readOnly, true);
  assert.equal(settings.thinkingLevel, 'low');
  assert.equal(settings.sendReasoningToCustom, false);
  assert.equal(settings.contextChars, 46000);
  assert.equal(context.window.NavigatorSettings.outputTokensFor('high'), 12288);
  assert.equal(context.window.NavigatorSettings.outputTokensFor('off'), 2048);
  assert.equal(context.window.NavigatorSettings.MAX_OUTPUT_TOKENS_CEILING, 12288);

  const failing = makeContext(false);
  vm.runInContext(settingsSource, failing);
  await assert.rejects(() => failing.window.NavigatorSettings.load(), /timed out/);
  vm.runInContext(mutationsSource, failing);
  const failingMutations = new failing.window.NavigatorMutations('short');
  await assert.rejects(
    () => failingMutations.apply({ status: 'applying', shortId: 'short' }),
    error => error?.code === 'read_only'
  );

  const executorContext = { console, window: {}, setTimeout, clearTimeout };
  vm.createContext(executorContext);
  vm.runInContext(executorSource, executorContext);
  const chat = executorContext.window.UltrascriptsAIExecutor.createChatTask({
    systemInstruction: 'system',
    messages: [{ role: 'user', content: 'hello' }],
    budget: { maxInputChars: 1000, maxOutputTokens: 2048 },
    thinking: { level: 'off' },
  });
  assert.equal(chat.thinking.level, 'off');
  assert.throws(() => executorContext.window.UltrascriptsAIExecutor.createTask({
    prompt: 'hello',
    thinking: { level: 'off' },
  }), error => /thinking\.level must be one of/.test(error?.message));

  assert.match(runtimeSource, /normalizeThinking\(task\.thinking, false\)/);
  assert.match(runtimeSource, /normalizeThinking\(task\.thinking, true\)/);
  assert.match(runtimeSource, /function applyThinking\(payload, settings, model, thinking, chat = false\)/);
  assert.match(runtimeSource, /settings\.service !== 'gemini' && !chat/);
  assert.match(runtimeSource, /payload\.reasoning_effort = requestedLevel/);
  assert.match(runtimeSource, /payload\.reasoning = requestedLevel === 'off'/);
  assert.match(runtimeSource, /sendReasoningToCustom !== true/);
  assert.match(runtimeSource, /unsupportedReasoning/);
  assert.match(runtimeSource, /thinkingCapabilityCache\.set\(capabilityKey, false\)/);
  assert.match(runtimeSource, /chatAttempt\(config, settings, task, session, model, attempted, onDelta, onStage\)/);
  assert.match(runtimeSource, /type: 'stage'/);
  assert.match(runtimeSource, /output_exhausted/);
  assert.doesNotMatch(runtimeSource, /queryPayload[\s\S]{0,1200}payload\.reasoning\s*=/);

  const sessionSource = fs.readFileSync(path.join(root, 'services/navigator/session.js'), 'utf8');
  const featureSource = fs.readFileSync(path.join(root, 'features/navigator_feature.js'), 'utf8');
  assert.match(sessionSource, /streamStage: 'connecting'/);
  assert.match(sessionSource, /onStage:/);
  assert.match(featureSource, /bd-navigator-thinking-dots/);
  assert.match(featureSource, /bd-navigator-stop-emphasized/);
  assert.match(featureSource, /provider did not apply it/);
  console.log('Mobile Navigator settings and reasoning contract tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
