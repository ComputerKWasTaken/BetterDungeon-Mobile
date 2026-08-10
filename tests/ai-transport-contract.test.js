'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', 'app', 'src', 'main', 'assets', 'betterdungeon');
const storage = new Map();
const cancelledRequests = [];
const pageListeners = new Map();
const popupResponseWaiters = new Map();

global.window = global;
global.location = { protocol: 'https:', href: 'https://play.aidungeon.com/adventure/test' };
global.addEventListener = (type, listener) => {
  const listeners = pageListeners.get(type) || [];
  listeners.push(listener);
  pageListeners.set(type, listeners);
};
global.removeEventListener = (type, listener) => {
  const listeners = pageListeners.get(type) || [];
  pageListeners.set(type, listeners.filter(candidate => candidate !== listener));
};
global.atob ||= value => Buffer.from(value, 'base64').toString('binary');

function emitNative(requestId, event) {
  window.__bdNativeAiTransportEvent(requestId, JSON.stringify(event));
}

global.BetterDungeonBridge = {
  storageGet(key) {
    return storage.get(key) || '';
  },
  storageGetAll() {
    return `{${Array.from(storage.entries()).map(([key, value]) => `${JSON.stringify(key)}:${value}`).join(',')}}`;
  },
  storageSet(key, value) {
    storage.set(key, value);
  },
  storageRemove(key) {
    storage.delete(key);
  },
  getAppVersion() {
    return '2.1.0-test';
  },
  aiFetch(requestJson, requestId) {
    const request = JSON.parse(requestJson);
    const payload = JSON.parse(request.body);
    const holding = JSON.stringify(payload).includes('hold-open');

    queueMicrotask(() => {
      emitNative(requestId, {
        type: 'response',
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/event-stream' },
      });
      if (holding) return;

      if (payload.stream !== true) {
        const data = request.url.includes('generativelanguage.googleapis.com')
          ? {
              id: 'gemini-query-test',
              model: 'gemini-mock',
              steps: [{ type: 'model_output', content: [{ type: 'text', text: 'Gemini query answer' }] }],
              usage: { total_tokens: 4 },
            }
          : {
              model: 'mock-model',
              choices: [{ message: { content: 'OpenAI query answer' } }],
              usage: { total_tokens: 4 },
            };
        emitNative(requestId, {
          type: 'chunk',
          data: Buffer.from(JSON.stringify(data), 'utf8').toString('base64'),
        });
        emitNative(requestId, { type: 'complete' });
        return;
      }

      const frames = request.url.includes('generativelanguage.googleapis.com')
        ? [
            `data: ${JSON.stringify({ event_type: 'interaction.created', interaction: { id: 'gemini-test', model: 'gemini-mock' } })}\n\n`,
            `data: ${JSON.stringify({ event_type: 'step.start', index: 0, step: { type: 'model_output', content: [] } })}\n\n`,
            `data: ${JSON.stringify({ event_type: 'step.delta', index: 0, delta: { type: 'text', text: 'Gemini ' } })}\n\n`,
            `data: ${JSON.stringify({ event_type: 'step.delta', index: 0, delta: { type: 'text', text: 'works' } })}\n\n`,
            `data: ${JSON.stringify({ event_type: 'interaction.completed', interaction: { id: 'gemini-test', model: 'gemini-mock', status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: 'Gemini works' }] }], usage: { total_tokens: 5 } } })}\n\ndata: [DONE]\n\n`,
          ]
        : [
            `data: ${JSON.stringify({ model: 'mock-model', choices: [{ delta: { content: 'Hello ' }, finish_reason: null }] })}\n\n`,
            `data: ${JSON.stringify({ choices: [{ delta: { content: 'world' }, finish_reason: 'stop' }], usage: { total_tokens: 7 } })}\n\ndata: [DONE]\n\n`,
          ];
      frames.forEach(frame => emitNative(requestId, {
        type: 'chunk',
        data: Buffer.from(frame, 'utf8').toString('base64'),
      }));
      emitNative(requestId, { type: 'complete' });
    });
  },
  aiCancel(requestId) {
    cancelledRequests.push(requestId);
    return true;
  },
  sendResponseToPopup(responseJson, requestId) {
    const resolve = popupResponseWaiters.get(requestId);
    if (!resolve) return;
    popupResponseWaiters.delete(requestId);
    resolve(JSON.parse(responseJson));
  },
};

function load(relativePath) {
  const filename = path.join(ROOT, relativePath);
  vm.runInThisContext(fs.readFileSync(filename, 'utf8'), { filename });
}

load('utils/webview-polyfill.js');
load('utils/ai-native-runtime.js');
load('modules/ai/executor.js');
load('modules/ai/gemini-backend.js');
load('modules/ai/openai-backend.js');

async function configureOpenAi() {
  const response = await chrome.runtime.sendMessage({
    type: 'ULTRASCRIPTS_AI_OPENAI',
    request: {
      op: 'settings:set',
      baseUrl: 'https://provider.example/v1',
      apiKey: 'test-key',
      model: 'mock-model',
    },
  });
  assert.equal(response.ok, true);
  window.UltrascriptsAIExecutor.setDefaultProvider('openai');
}

async function testPopupRuntimeRouting() {
  const requestId = 'popup-contract-test';
  const responsePromise = new Promise(resolve => popupResponseWaiters.set(requestId, resolve));
  window.__bdDispatchMessageFromPopup({
    type: 'ULTRASCRIPTS_AI_OPENAI',
    request: { op: 'status' },
  }, requestId);
  const response = await responsePromise;
  assert.equal(response.ok, true);
  assert.equal(response.data.ready, true);
  assert.equal(response.data.config.model, 'mock-model');
}

function chatArgs(content) {
  return {
    messages: [{ role: 'user', content }],
    systemInstruction: 'Answer briefly.',
    budget: { maxInputChars: 4000, maxOutputTokens: 128 },
    thinking: { level: 'minimal' },
    tools: [],
  };
}

async function testStreaming() {
  const deltas = [];
  const result = await window.UltrascriptsAIExecutor.chat(chatArgs('say hello'), {
    onDelta(delta) {
      deltas.push(delta.text);
    },
  });
  assert.equal(result.text, 'Hello world');
  assert.deepEqual(deltas, ['Hello ', 'world']);
  assert.equal(result.meta.provider, 'openai');
  assert.equal(result.meta.providerModel, 'mock-model');
  assert.deepEqual(result.meta.usage, { total_tokens: 7 });
}

async function testQueries() {
  window.UltrascriptsAIExecutor.setDefaultProvider('openai');
  const openAi = await window.UltrascriptsAIExecutor.query({ prompt: 'query openai' });
  assert.equal(openAi.text, 'OpenAI query answer');
  assert.equal(openAi.meta.providerModel, 'mock-model');

  window.UltrascriptsAIExecutor.setDefaultProvider('gemini');
  const gemini = await window.UltrascriptsAIExecutor.query({ prompt: 'query gemini' });
  assert.equal(gemini.text, 'Gemini query answer');
  assert.equal(gemini.meta.providerModel, 'gemini-mock');
}

async function testGeminiStreaming() {
  const settings = await chrome.runtime.sendMessage({
    type: 'ULTRASCRIPTS_AI_GEMINI',
    request: { op: 'settings:set', apiKey: 'gemini-test-key', modelMode: 'manual', model: 'gemini-mock' },
  });
  assert.equal(settings.ok, true);
  window.UltrascriptsAIExecutor.setDefaultProvider('gemini');
  const deltas = [];
  const result = await window.UltrascriptsAIExecutor.chat(chatArgs('test gemini'), {
    onDelta(delta) { deltas.push(delta.text); },
  });
  assert.equal(result.text, 'Gemini works');
  assert.deepEqual(deltas, ['Gemini ', 'works']);
  assert.equal(result.meta.provider, 'gemini');
  assert.equal(result.meta.providerModel, 'gemini-mock');
}

async function testCancellation() {
  window.UltrascriptsAIExecutor.setDefaultProvider('openai');
  const controller = new AbortController();
  const pending = window.UltrascriptsAIExecutor.chat(chatArgs('hold-open'), {
    signal: controller.signal,
  });
  setTimeout(() => controller.abort(), 5);
  await assert.rejects(pending, error => error && error.code === 'aborted');
  assert.ok(cancelledRequests.length > 0, 'native cancellation should be requested');
}

(async () => {
  await configureOpenAi();
  await testPopupRuntimeRouting();
  await testStreaming();
  await testGeminiStreaming();
  await testQueries();
  await testCancellation();
  console.log('AI native transport contract tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
