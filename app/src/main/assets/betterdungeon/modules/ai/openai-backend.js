// modules/ai/openai-backend.js
//
// Content-side OpenAI-compatible provider adapter. Transport and secret storage
// stay in the WebView polyfill runtime; this file only registers a provider
// with the provider-agnostic AI executor and applies the stored default
// provider selection.

(function () {
  if (window.UltrascriptsAIOpenAIBackend) return;

  const MESSAGE_TYPE = 'ULTRASCRIPTS_AI_OPENAI';
  const DEFAULT_PROVIDER_STORAGE_KEY = 'ultrascripts_ai_default_provider';

  function runtime() {
    if (typeof browser !== 'undefined' && browser?.runtime?.sendMessage) return browser.runtime;
    if (typeof chrome !== 'undefined' && chrome?.runtime?.sendMessage) return chrome.runtime;
    return null;
  }

  function unwrapResponse(response) {
    if (response?.ok) return response.data;
    throw response?.error || { code: 'backend_failed', message: 'OpenAI backend request failed' };
  }

  function sendOpenAiMessage(request) {
    const rt = runtime();
    if (!rt?.sendMessage) {
      return Promise.reject({
        code: 'unavailable',
        message: 'Extension runtime is unavailable.',
        retryable: true,
      });
    }

    const message = { type: MESSAGE_TYPE, request };
    if (typeof browser !== 'undefined' && browser?.runtime?.sendMessage) {
      return browser.runtime.sendMessage(message).then(unwrapResponse);
    }

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        const lastError = chrome.runtime?.lastError;
        if (lastError) {
          reject({
            code: 'unavailable',
            message: lastError.message || 'OpenAI backend request failed',
            retryable: true,
          });
          return;
        }
        try {
          resolve(unwrapResponse(response));
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  const state = {
    status: {
      ready: false,
      available: false,
      reason: 'ai_backend_status_unknown',
      config: null,
      message: 'OpenAI backend status has not been checked yet.',
    },
  };

  function normalizeStatus(status) {
    const raw = status && typeof status === 'object' ? status : {};
    return {
      ready: raw.ready === true,
      available: raw.available === true,
      reason: typeof raw.reason === 'string' ? raw.reason : null,
      config: raw.config && typeof raw.config === 'object' ? raw.config : null,
      message: typeof raw.message === 'string' ? raw.message : '',
    };
  }

  async function refreshStatus() {
    try {
      state.status = normalizeStatus(await sendOpenAiMessage({ op: 'status' }));
    } catch (err) {
      state.status = {
        ready: false,
        available: false,
        reason: err?.code || 'ai_backend_status_failed',
        config: null,
        message: err?.message || 'OpenAI backend status check failed.',
      };
    }
    return state.status;
  }

  const provider = {
    id: 'openai',
    label: 'OpenAI-Compatible',
    supports: { text: true, json: true, thinking: false },
    status: () => state.status,
    query: async (task) => {
      const result = await sendOpenAiMessage({ op: 'query', task });
      if (result?.status) state.status = normalizeStatus(result.status);
      return {
        provider: 'openai',
        backend: 'openai',
        generatedAtIso: result?.generatedAtIso,
        model: result?.model,
        providerModel: result?.providerModel,
        usage: result?.usage,
        fallback: result?.fallback,
        text: result?.text,
        json: result?.json,
      };
    },
    refreshStatus,
  };

  function storageArea() {
    if (typeof browser !== 'undefined' && browser?.storage?.sync) return browser.storage;
    if (typeof chrome !== 'undefined' && chrome?.storage?.sync) return chrome.storage;
    return null;
  }

  function applyDefaultProvider(providerId) {
    const executor = window.UltrascriptsAIExecutor;
    if (!executor?.setDefaultProvider) return;
    const id = providerId === 'openai' ? 'openai' : 'gemini';
    try {
      executor.setDefaultProvider(id);
    } catch { /* provider not registered yet */ }
  }

  function watchDefaultProvider() {
    const storage = storageArea();
    if (!storage) return;
    try {
      storage.sync.get(DEFAULT_PROVIDER_STORAGE_KEY, (result) => {
        const stored = (result || {})[DEFAULT_PROVIDER_STORAGE_KEY];
        if (stored) applyDefaultProvider(stored);
      });
      storage.onChanged?.addListener((changes, areaName) => {
        if (areaName !== 'sync' || !changes[DEFAULT_PROVIDER_STORAGE_KEY]) return;
        applyDefaultProvider(changes[DEFAULT_PROVIDER_STORAGE_KEY].newValue);
      });
    } catch { /* noop */ }
  }

  const api = {
    provider,
    backend: provider,
    refreshStatus,
    register() {
      const executor = window.UltrascriptsAIExecutor;
      if (!executor?.registerProvider) return false;
      executor.registerProvider(provider);
      refreshStatus();
      watchDefaultProvider();
      return true;
    },
  };

  window.UltrascriptsAIOpenAIBackend = api;
  api.register();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
