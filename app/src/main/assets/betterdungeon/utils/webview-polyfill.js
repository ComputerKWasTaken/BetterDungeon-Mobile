// BetterDungeon - WebView Polyfill
// Replaces chrome.* extension APIs with Android WebView equivalents.
//
// Storage:    Routes through @JavascriptInterface → SharedPreferences
// Runtime:    getURL() returns file:///android_asset/ paths; onMessage uses a
//             simple in-page event bus (CustomEvent on window)
// Tabs:       query() returns a fake "current tab"; sendMessage() dispatches
//             through the same event bus

(function () {
  'use strict';

  // ── Storage Change Listeners ──────────────────────────────────────
  // Track storage.onChanged listeners for cross-feature reactivity

  var storageChangeListeners = [];

  function fireStorageChanged(changes, areaName) {
    for (var i = 0; i < storageChangeListeners.length; i++) {
      try {
        storageChangeListeners[i](changes, areaName);
      } catch (err) {
        console.error('[WebView Polyfill] storage.onChanged listener error:', err);
      }
    }
  }

  // ── Storage Bridge ──────────────────────────────────────────────────
  // Uses the native BetterDungeonBridge exposed via @JavascriptInterface

  function createStorageArea(areaName) {
    return {
      get: function (keys, callback) {
        function doGet() {
          // Normalise keys to an array
          var keyList;
          if (typeof keys === 'string') {
            keyList = [keys];
          } else if (Array.isArray(keys)) {
            keyList = keys;
          } else if (keys === null || keys === undefined) {
            // Get everything
            keyList = null;
          } else if (typeof keys === 'object') {
            keyList = Object.keys(keys);
          } else {
            keyList = [];
          }

          var result = {};

          if (keyList === null) {
            // Get all stored data
            var allDataJson = window.BetterDungeonBridge.storageGetAll();
            try {
              result = JSON.parse(allDataJson || '{}');
            } catch (e) {
              result = {};
            }
          } else {
            for (var i = 0; i < keyList.length; i++) {
              var key = keyList[i];
              var raw = window.BetterDungeonBridge.storageGet(key);
              if (raw !== null && raw !== undefined && raw !== '') {
                try {
                  result[key] = JSON.parse(raw);
                } catch (e) {
                  result[key] = raw;
                }
              } else if (typeof keys === 'object' && !Array.isArray(keys) && keys !== null) {
                // Use default value from the keys object
                result[key] = keys[key];
              }
            }
          }

          return result;
        }

        // Support both callback style and Promise style (Manifest V3)
        if (typeof callback === 'function') {
          try {
            callback(doGet());
          } catch (err) {
            console.error('[WebView Polyfill] storage.get error:', err);
            callback({});
          }
          return;
        }

        // Return a Promise when no callback is provided
        return new Promise(function (resolve) {
          try {
            resolve(doGet());
          } catch (err) {
            console.error('[WebView Polyfill] storage.get error:', err);
            resolve({});
          }
        });
      },

      set: function (items, callback) {
        function doSet() {
          var changes = {};
          var itemKeys = Object.keys(items);
          for (var i = 0; i < itemKeys.length; i++) {
            var key = itemKeys[i];
            var newValue = items[key];

            // Read old value for onChanged notification
            var oldValue;
            try {
              var oldRaw = window.BetterDungeonBridge.storageGet(key);
              if (oldRaw !== null && oldRaw !== undefined && oldRaw !== '') {
                oldValue = JSON.parse(oldRaw);
              }
            } catch (e) { /* old value unavailable */ }

            window.BetterDungeonBridge.storageSet(key, JSON.stringify(newValue));

            changes[key] = { newValue: newValue };
            if (oldValue !== undefined) {
              changes[key].oldValue = oldValue;
            }
          }

          // Notify storage.onChanged listeners
          if (Object.keys(changes).length > 0) {
            fireStorageChanged(changes, areaName);
          }
        }

        // Support both callback style and Promise style (Manifest V3)
        if (typeof callback === 'function') {
          try {
            doSet();
            callback();
          } catch (err) {
            console.error('[WebView Polyfill] storage.set error:', err);
            callback();
          }
          return;
        }

        // Return a Promise when no callback is provided
        return new Promise(function (resolve) {
          try {
            doSet();
            resolve();
          } catch (err) {
            console.error('[WebView Polyfill] storage.set error:', err);
            resolve();
          }
        });
      },

      remove: function (keys, callback) {
        function doRemove() {
          var keyList = typeof keys === 'string' ? [keys] : keys;
          for (var i = 0; i < keyList.length; i++) {
            window.BetterDungeonBridge.storageRemove(keyList[i]);
          }
        }

        // Support both callback style and Promise style (Manifest V3)
        if (typeof callback === 'function') {
          try {
            doRemove();
            callback();
          } catch (err) {
            console.error('[WebView Polyfill] storage.remove error:', err);
            callback();
          }
          return;
        }

        // Return a Promise when no callback is provided
        return new Promise(function (resolve) {
          try {
            doRemove();
            resolve();
          } catch (err) {
            console.error('[WebView Polyfill] storage.remove error:', err);
            resolve();
          }
        });
      }
    };
  }

  // ── Message Bus ─────────────────────────────────────────────────────
  // In-page event bus replacing chrome.runtime.onMessage / chrome.tabs.sendMessage

  var messageListeners = [];

  var onMessageAPI = {
    addListener: function (listener) {
      if (typeof listener === 'function' && messageListeners.indexOf(listener) === -1) {
        messageListeners.push(listener);
      }
    },
    removeListener: function (listener) {
      var idx = messageListeners.indexOf(listener);
      if (idx !== -1) {
        messageListeners.splice(idx, 1);
      }
    },
    hasListener: function (listener) {
      return messageListeners.indexOf(listener) !== -1;
    }
  };

  function dispatchMessage(message, sender) {
    sender = sender || { id: 'betterdungeon-android' };

    for (var i = 0; i < messageListeners.length; i++) {
      try {
        var sendResponse = (function () {
          var called = false;
          return function (response) {
            if (!called) {
              called = true;
              // Store for popup retrieval
              window.__bdLastResponse = response;
            }
          };
        })();

        var result = messageListeners[i](message, sender, sendResponse);

        // If listener returns true, it will call sendResponse asynchronously
        if (result === true) {
          // The listener will call sendResponse later
        }
      } catch (err) {
        console.error('[WebView Polyfill] Message listener error:', err);
      }
    }
  }

  // ── Build the polyfilled chrome object ──────────────────────────────

  var syncStorageArea = createStorageArea('sync');
  var localStorageArea = createStorageArea('local');

  var GEMINI_MESSAGE = 'ULTRASCRIPTS_AI_GEMINI';
  var WEBFETCH_MESSAGE = 'ULTRASCRIPTS_WEBFETCH_FETCH';
  var SDK_MESSAGE = 'ULTRASCRIPTS_SDK_REQUEST';
  var GEMINI_DEFAULT_MODEL = 'gemini-3.5-flash-lite';
  var GEMINI_DEFAULT_MODEL_MODE = 'auto';
  var GEMINI_DEFAULT_TIMEOUT_MS = 120000;
  var GEMINI_PROMPT_MAX_CHARS = 12000;
  var GEMINI_THINKING_LEVELS = ['minimal', 'low', 'medium', 'high'];
  var GEMINI_OUTPUT_TYPES = ['text', 'json'];
  var GEMINI_AUTO_STEPDOWN_MODELS = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemma-4-31b-it',
    'gemma-4-26b-a4b-it'
  ];
  var GEMINI_STORAGE_KEYS = {
    apiKey: 'ultrascripts_ai_gemini_api_key',
    model: 'ultrascripts_ai_gemini_model',
    modelMode: 'ultrascripts_ai_gemini_model_mode'
  };
  var OPENAI_MESSAGE = 'ULTRASCRIPTS_AI_OPENAI';
  var OPENAI_STORAGE_KEYS = {
    baseUrl: 'ultrascripts_ai_openai_base_url',
    apiKey: 'ultrascripts_ai_openai_api_key',
    model: 'ultrascripts_ai_openai_model'
  };
  var openaiRuntimeState = {
    lastModel: null,
    lastResolvedAtIso: null
  };
  var SDK_SYNC_STORAGE_KEYS = {
    features: 'betterDungeonFeatures',
    moduleStates: 'ultrascripts_enabled_modules',
    debug: 'ultrascripts_debug'
  };
  var SDK_DEFAULT_FEATURES = {
    ultrascripts: true,
    markdown: true,
    command: true,
    try: true,
    triggerHighlight: true,
    favoriteInstructions: true,
    inputModeColor: true,
    characterPreset: true,
    autoSee: false,
    notes: true,
    autoEnableScripts: true,
    inputHistory: true,
    textToSpeech: false,
    customDynamic: false,
    navigator: true
  };
  var SDK_ULTRASCRIPTS_MODULES = [
    'widget',
    'webfetch',
    'clock',
    'sdk',
    'audio',
    'weather',
    'network',
    'system',
    'ai'
  ];
  var nativeWebFetchSequence = 0;
  var nativeWebFetchPending = {};
  var geminiRuntimeState = {
    lastResolvedModel: null,
    lastProviderModel: null,
    lastResolvedAtIso: null,
    lastFallbackMode: null,
    lastAttemptedModels: []
  };

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function cloneJson(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeRuntimeError(error) {
    if (error && typeof error === 'object') {
      return {
        code: typeof error.code === 'string' ? error.code : 'mobile_runtime_failed',
        message: typeof error.message === 'string' ? error.message : String(error),
        retryable: error.retryable === true,
        status: error.status,
        statusText: error.statusText,
        retryAfterMs: error.retryAfterMs,
        detail: error.detail,
        backend: error.backend,
        model: error.model,
        providerReason: error.providerReason
      };
    }
    return { code: 'mobile_runtime_failed', message: String(error || 'Mobile runtime request failed') };
  }

  function storageGetPromise(area, keys) {
    return Promise.resolve(area.get(keys));
  }

  function storageSetPromise(area, data) {
    return Promise.resolve(area.set(data));
  }

  function normalizeGeminiModel(value) {
    var model = String(value || GEMINI_DEFAULT_MODEL).trim().replace(/^models\//, '');
    return model || GEMINI_DEFAULT_MODEL;
  }

  function normalizeGeminiModelMode(value) {
    return String(value || '').trim().toLowerCase() === 'manual' ? 'manual' : GEMINI_DEFAULT_MODEL_MODE;
  }

  function normalizeGeminiFallbackChain(value) {
    var raw = Array.isArray(value) ? value : GEMINI_AUTO_STEPDOWN_MODELS;
    var seen = {};
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var model = normalizeGeminiModel(raw[i]);
      if (!model || seen[model]) continue;
      seen[model] = true;
      out.push(model);
    }
    if (!out.length) out.push(GEMINI_DEFAULT_MODEL);
    return out;
  }

  async function getGeminiSettings() {
    var local = await storageGetPromise(localStorageArea, Object.keys(GEMINI_STORAGE_KEYS).map(function (k) {
      return GEMINI_STORAGE_KEYS[k];
    }));
    var apiKey = String(local[GEMINI_STORAGE_KEYS.apiKey] || '').trim();
    return {
      apiKey: apiKey,
      model: normalizeGeminiModel(local[GEMINI_STORAGE_KEYS.model]),
      modelMode: normalizeGeminiModelMode(local[GEMINI_STORAGE_KEYS.modelMode]),
      fallbackChain: normalizeGeminiFallbackChain(GEMINI_AUTO_STEPDOWN_MODELS),
      keyConfigured: !!apiKey
    };
  }

  function geminiQueryModels(settings) {
    if (settings && settings.modelMode === 'manual') return [normalizeGeminiModel(settings.model)];
    return normalizeGeminiFallbackChain(settings && settings.fallbackChain);
  }

  function geminiStatus(settings, actualModel) {
    var ready = !!(settings && settings.keyConfigured);
    var models = geminiQueryModels(settings);
    var selectedModel = models[0] || GEMINI_DEFAULT_MODEL;
    return {
      backend: 'gemini',
      backendLabel: 'Gemini',
      ready: ready,
      available: ready,
      reason: ready ? null : 'ai_backend_not_configured',
      supports: { text: true, json: true, thinking: true },
      config: {
        provider: 'gemini',
        api: 'interactions',
        apiVersion: 'v1',
        stateless: true,
        adjustableSafety: 'provider-default',
        keyConfigured: ready,
        modelMode: normalizeGeminiModelMode(settings && settings.modelMode),
        model: selectedModel,
        selectedModel: selectedModel,
        activeModel: actualModel || geminiRuntimeState.lastResolvedModel || null,
        fallbackModels: models,
        thinkingDefault: 'minimal',
        thinkingLevels: GEMINI_THINKING_LEVELS.slice(),
        lastResolvedModel: geminiRuntimeState.lastResolvedModel,
        lastProviderModel: geminiRuntimeState.lastProviderModel,
        lastResolvedAtIso: geminiRuntimeState.lastResolvedAtIso,
        lastFallbackMode: geminiRuntimeState.lastFallbackMode,
        lastAttemptedModels: geminiRuntimeState.lastAttemptedModels.slice()
      },
      message: ready
        ? 'Gemini backend is configured.'
        : 'Add a Gemini API key in BetterDungeon to enable AI queries.'
    };
  }

  function normalizeGeminiThinking(thinking) {
    if (thinking === undefined || thinking === null) return { level: 'minimal' };
    if (typeof thinking === 'string') thinking = { level: thinking };
    if (!isObject(thinking)) throw { code: 'invalid_args', message: 'thinking must be a string or object' };
    var level = String(thinking.level === undefined ? 'minimal' : thinking.level).trim().toLowerCase();
    if (GEMINI_THINKING_LEVELS.indexOf(level) === -1) {
      throw { code: 'invalid_args', message: 'thinking.level must be one of: ' + GEMINI_THINKING_LEVELS.join(', ') };
    }
    return { level: level };
  }

  function normalizeGeminiTask(task) {
    if (!isObject(task)) throw { code: 'invalid_args', message: 'Gemini query task must be an object' };
    if (typeof task.prompt !== 'string' || !task.prompt.trim()) {
      throw { code: 'invalid_args', message: 'prompt is required' };
    }
    if (task.prompt.length > GEMINI_PROMPT_MAX_CHARS) {
      throw {
        code: 'invalid_args',
        message: 'prompt must be ' + GEMINI_PROMPT_MAX_CHARS + ' characters or less',
        maxChars: GEMINI_PROMPT_MAX_CHARS,
        actualChars: task.prompt.length
      };
    }
    var output = isObject(task.output) ? task.output : { type: 'text' };
    var type = output.type === undefined ? 'text' : output.type;
    if (typeof type !== 'string' || GEMINI_OUTPUT_TYPES.indexOf(type) === -1) {
      throw { code: 'invalid_args', message: 'output.type must be one of: ' + GEMINI_OUTPUT_TYPES.join(', ') };
    }
    if (type === 'json' && !isObject(output.schema)) {
      throw { code: 'invalid_args', message: 'output.schema is required when output.type is json' };
    }
    return {
      id: typeof task.id === 'string' ? task.id : null,
      prompt: task.prompt,
      promptChars: Number(task.promptChars || task.prompt.length),
      thinking: normalizeGeminiThinking(task.thinking),
      output: { type: type, schema: output.schema ? cloneJson(output.schema) : undefined }
    };
  }

  function geminiThinkingFamily(model) {
    var id = String(model || '').trim().toLowerCase().replace(/^models\//, '');
    if (/^gemini-3\.1-pro(?:[.-]|$)/.test(id)) return 'gemini-3-pro';
    if (/^gemini-3(?:[.-]|$)/.test(id)) return 'gemini-3';
    if (/^gemini-2\.5(?:[.-]|$)/.test(id)) return 'gemini-2.5';
    if (/^gemma-4(?:[.-]|$)/.test(id)) return 'gemma-4';
    return 'unknown';
  }

  function geminiThinkingConfigForModel(model, thinking) {
    var level = normalizeGeminiThinking(thinking).level;
    var family = geminiThinkingFamily(model);
    if (family === 'gemini-3' || family === 'gemini-3-pro') {
      var appliedLevel = family === 'gemini-3-pro' && level === 'minimal' ? 'low' : level;
      return {
        config: { thinking_level: appliedLevel },
        appliedLevel: appliedLevel,
        appliedBudget: null,
        family: family
      };
    }
    if (family === 'gemini-2.5') {
      var appliedLevel25 = level === 'minimal' ? 'low' : level;
      return {
        config: { thinking_level: appliedLevel25 },
        appliedLevel: appliedLevel25,
        appliedBudget: null,
        family: family
      };
    }
    if (family === 'gemma-4' && level !== 'minimal') {
      return {
        config: { thinking_level: 'high' },
        appliedLevel: 'high',
        appliedBudget: null,
        family: family,
        toggle: true
      };
    }
    return { config: null, appliedLevel: null, appliedBudget: null, family: family };
  }

  function geminiThinkingMeta(task, model, thinking) {
    var requestedLevel = normalizeGeminiThinking(task.thinking).level;
    var meta = {
      requestedLevel: requestedLevel,
      applied: !!(thinking && thinking.config),
      family: (thinking && thinking.family) || geminiThinkingFamily(model),
      defaulted: requestedLevel === 'minimal'
    };
    if (thinking && thinking.appliedLevel) meta.appliedLevel = thinking.appliedLevel;
    if (thinking && Number.isFinite(thinking.appliedBudget)) meta.appliedBudget = thinking.appliedBudget;
    if (thinking && thinking.toggle) meta.toggle = true;
    return meta;
  }

  function geminiPayload(task, model) {
    var payload = {
      model: model,
      input: task.prompt,
      store: false
    };
    if (task.output.type === 'json') {
      payload.response_format = {
        type: 'text',
        mime_type: 'application/json',
        schema: task.output.schema
      };
    }
    var thinking = geminiThinkingConfigForModel(model, task.thinking);
    if (thinking.config) payload.generation_config = thinking.config;
    return { payload: payload, thinking: thinking };
  }

  function geminiProviderReason(value) {
    var candidates = [];
    function collect(candidate) {
      if (typeof candidate === 'string' && candidate.trim()) candidates.push(candidate.trim());
    }
    collect(value && value.error && value.error.code);
    collect(value && value.error && value.error.status);
    collect(value && value.error && value.error.message);
    collect(value && value.blockReason);
    collect(value && value.block_reason);
    collect(value && value.finishReason);
    collect(value && value.finish_reason);
    collect(value && value.incomplete_details && value.incomplete_details.reason);
    collect(value && value.status);
    var steps = Array.isArray(value && value.steps) ? value.steps : [];
    steps.forEach(function (step) {
      collect(step && step.error && step.error.code);
      collect(step && step.error && step.error.message);
      collect(step && step.block_reason);
      collect(step && step.finish_reason);
      collect(step && step.status);
    });
    var joined = candidates.join(' | ');
    if (/PROHIBITED_CONTENT/i.test(joined)) return 'PROHIBITED_CONTENT';
    if (/(^|\W)SAFETY($|\W)|SAFETY_FILTER|CONTENT_FILTER/i.test(joined)) return 'SAFETY';
    return candidates[0] || null;
  }

  function geminiBlockedError(reason, detail, model) {
    var prohibited = reason === 'PROHIBITED_CONTENT';
    return {
      code: prohibited ? 'prohibited_content' : 'safety_blocked',
      message: prohibited
        ? 'Gemini rejected the request under a non-adjustable content policy.'
        : 'Gemini blocked the request with an adjustable safety filter.',
      retryable: false,
      backend: 'gemini',
      providerReason: reason,
      detail: detail || reason,
      model: model
    };
  }

  function extractGeminiText(data, model) {
    var steps = Array.isArray(data && data.steps) ? data.steps : [];
    var outputSteps = steps.filter(function (step) { return step && step.type === 'model_output'; });
    var lastOutput = outputSteps.length ? outputSteps[outputSteps.length - 1] : null;
    var content = Array.isArray(lastOutput && lastOutput.content) ? lastOutput.content : [];
    var text = content.map(function (part) {
      return part && part.type === 'text' && typeof part.text === 'string' ? part.text : '';
    }).filter(Boolean).join('');
    if (!text) {
      var providerReason = geminiProviderReason(data);
      if (providerReason === 'PROHIBITED_CONTENT' || providerReason === 'SAFETY') {
        throw geminiBlockedError(providerReason, data && data.error && data.error.message, model);
      }
      throw {
        code: 'invalid_response',
        message: providerReason
          ? 'Gemini returned no text output (' + providerReason + ').'
          : 'Gemini returned no model output text.',
        retryable: false,
        backend: 'gemini',
        providerReason: providerReason,
        model: model
      };
    }
    return text;
  }

  function geminiHttpError(response, bodyText) {
    var parsed = null;
    try { parsed = JSON.parse(bodyText || '{}'); } catch (e) { parsed = null; }
    var providerMessage = (parsed && parsed.error && parsed.error.message) || response.statusText || 'HTTP ' + response.status;
    var providerReason = geminiProviderReason(parsed);
    if (providerReason === 'PROHIBITED_CONTENT' || providerReason === 'SAFETY') {
      var blocked = geminiBlockedError(providerReason, providerMessage);
      blocked.status = response.status;
      blocked.statusText = response.statusText;
      return blocked;
    }
    if (response.status === 401 || response.status === 403) {
      return { code: 'auth_failed', message: 'Gemini API key was rejected.', status: response.status, detail: providerMessage, backend: 'gemini' };
    }
    if (response.status === 429) {
      return { code: 'rate_limit', message: 'Gemini rate limit reached.', retryable: true, status: response.status, detail: providerMessage, backend: 'gemini' };
    }
    if (response.status === 400) {
      return { code: 'invalid_args', message: providerMessage, status: response.status, backend: 'gemini' };
    }
    return { code: 'backend_failed', message: providerMessage, retryable: response.status >= 500, status: response.status, backend: 'gemini' };
  }

  async function callGeminiInteraction(settings, task) {
    if (!settings.keyConfigured) {
      throw { code: 'not_configured', message: 'No Gemini API key is configured.', backend: 'gemini' };
    }
    var models = geminiQueryModels(settings);
    var lastError = null;
    for (var i = 0; i < models.length; i++) {
      var model = models[i];
      var payloadInfo = geminiPayload(task, model);
      var controller = new AbortController();
      var timer = setTimeout(function () { controller.abort(); }, GEMINI_DEFAULT_TIMEOUT_MS);
      try {
        var response = await fetch('https://generativelanguage.googleapis.com/v1/interactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': settings.apiKey
          },
          body: JSON.stringify(payloadInfo.payload),
          credentials: 'omit',
          cache: 'no-store',
          signal: controller.signal
        });
        var bodyText = await response.text();
        if (!response.ok) {
          var httpError = geminiHttpError(response, bodyText);
          httpError.model = model;
          if (httpError.code === 'rate_limit' && settings.modelMode !== 'manual' && i + 1 < models.length) {
            lastError = httpError;
            continue;
          }
          throw httpError;
        }
        var data = null;
        try {
          data = JSON.parse(bodyText || '{}');
        } catch (parseError) {
          throw {
            code: 'invalid_response',
            message: 'Gemini returned invalid JSON.',
            retryable: false,
            backend: 'gemini',
            detail: (parseError && parseError.message) || 'invalid_json',
            model: model
          };
        }
        var text = extractGeminiText(data, model);
        var result = {
          backend: 'gemini',
          generatedAtIso: new Date().toISOString(),
          model: model,
          providerModel: data.model || model,
          interactionId: typeof data.id === 'string' ? data.id : null,
          usage: data.usage || null,
          status: geminiStatus(settings, model),
          thinking: geminiThinkingMeta(task, model, payloadInfo.thinking),
          fallback: {
            mode: settings.modelMode || GEMINI_DEFAULT_MODEL_MODE,
            attemptedModels: models.slice(0, i + 1)
          },
          text: text
        };
        geminiRuntimeState.lastResolvedModel = model;
        geminiRuntimeState.lastProviderModel = result.providerModel;
        geminiRuntimeState.lastResolvedAtIso = result.generatedAtIso;
        geminiRuntimeState.lastFallbackMode = result.fallback.mode;
        geminiRuntimeState.lastAttemptedModels = result.fallback.attemptedModels.slice();
        if (task.output.type === 'json') {
          try {
            result.json = JSON.parse(text);
          } catch (jsonError) {
            throw {
              code: 'invalid_response',
              message: 'Gemini returned invalid JSON text.',
              retryable: false,
              backend: 'gemini',
              detail: (jsonError && jsonError.message) || 'invalid_json',
              model: model
            };
          }
        }
        return result;
      } catch (err) {
        if (err && err.name === 'AbortError') {
          throw { code: 'timeout', message: 'Gemini query timed out after ' + GEMINI_DEFAULT_TIMEOUT_MS + ' ms.', retryable: true, backend: 'gemini', model: model };
        }
        if (err && err.code) throw err;
        throw { code: 'backend_failed', message: (err && err.message) || 'Gemini request failed.', retryable: true, backend: 'gemini', model: model };
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError || { code: 'rate_limit', message: 'Gemini rate limit reached.', retryable: true, backend: 'gemini' };
  }

  async function handleGemini(request) {
    request = request || {};
    var op = String(request.op || '').trim();
    if (op === 'settings:set') {
      var next = {};
      if (request.apiKey !== undefined) next[GEMINI_STORAGE_KEYS.apiKey] = String(request.apiKey || '').trim();
      if (request.model !== undefined) next[GEMINI_STORAGE_KEYS.model] = normalizeGeminiModel(request.model);
      if (request.modelMode !== undefined) next[GEMINI_STORAGE_KEYS.modelMode] = normalizeGeminiModelMode(request.modelMode);
      await storageSetPromise(localStorageArea, next);
      geminiRuntimeState.lastResolvedModel = null;
      geminiRuntimeState.lastProviderModel = null;
      geminiRuntimeState.lastResolvedAtIso = null;
      geminiRuntimeState.lastFallbackMode = null;
      geminiRuntimeState.lastAttemptedModels = [];
      return geminiStatus(await getGeminiSettings());
    }
    var settings = await getGeminiSettings();
    if (op === 'status') return geminiStatus(settings);
    if (op === 'test') {
      return callGeminiInteraction(settings, normalizeGeminiTask({
        id: 'popup-test',
        prompt: 'Reply with exactly: BetterDungeon Gemini ready',
        output: { type: 'text' }
      }));
    }
    if (op === 'query') return callGeminiInteraction(settings, normalizeGeminiTask(request.task));
    throw { code: 'invalid_args', message: "Gemini op '" + (op || '(empty)') + "' is not supported" };
  }

  function normalizeOpenAiBaseUrl(value) {
    var url = String(value || '').trim();
    if (!url) return '';
    url = url.replace(/\/+$/, '');
    url = url.replace(/\/chat\/completions$/, '');
    if (!/^https?:\/\//i.test(url)) return '';
    return url;
  }

  function normalizeOpenAiModel(value) {
    return String(value || '').trim();
  }

  async function getOpenAiSettings() {
    var local = await storageGetPromise(localStorageArea, Object.keys(OPENAI_STORAGE_KEYS).map(function (k) {
      return OPENAI_STORAGE_KEYS[k];
    }));
    var baseUrl = normalizeOpenAiBaseUrl(local[OPENAI_STORAGE_KEYS.baseUrl]);
    var apiKey = String(local[OPENAI_STORAGE_KEYS.apiKey] || '').trim();
    var model = normalizeOpenAiModel(local[OPENAI_STORAGE_KEYS.model]);
    return {
      baseUrl: baseUrl,
      apiKey: apiKey,
      model: model,
      keyConfigured: !!apiKey,
      configured: !!(baseUrl && model)
    };
  }

  function openaiStatus(settings) {
    var ready = !!(settings && settings.configured);
    return {
      backend: 'openai',
      backendLabel: 'OpenAI-Compatible',
      ready: ready,
      available: ready,
      reason: ready ? null : 'ai_backend_not_configured',
      supports: { text: true, json: true, thinking: false },
      config: {
        provider: 'openai',
        api: 'chat-completions',
        stateless: true,
        keyConfigured: !!(settings && settings.keyConfigured),
        baseUrl: (settings && settings.baseUrl) || '',
        baseUrlConfigured: !!(settings && settings.baseUrl),
        model: (settings && settings.model) || '',
        selectedModel: (settings && settings.model) || '',
        activeModel: openaiRuntimeState.lastModel,
        lastResolvedModel: openaiRuntimeState.lastModel,
        lastResolvedAtIso: openaiRuntimeState.lastResolvedAtIso
      },
      message: ready
        ? 'OpenAI-compatible backend is configured.'
        : 'Add a base URL and model in BetterDungeon to enable the OpenAI-compatible backend.'
    };
  }

  function openaiJsonSchemaInstruction(schema) {
    return 'Respond with a single JSON object that conforms to this JSON schema. Output only the JSON object with no surrounding prose or code fences.\nSchema: ' + JSON.stringify(schema);
  }

  function openaiPayload(task, model) {
    var messages = [];
    if (task.output.type === 'json' && task.output.schema) {
      messages.push({ role: 'system', content: openaiJsonSchemaInstruction(task.output.schema) });
    }
    messages.push({ role: 'user', content: task.prompt });

    var payload = { model: model, messages: messages, stream: false };
    if (task.output.type === 'json') {
      payload.response_format = { type: 'json_object' };
    }
    return { payload: payload };
  }

  function openaiBlockedError(detail, model) {
    return {
      code: 'safety_blocked',
      message: 'The OpenAI-compatible provider blocked the request with a content filter.',
      retryable: false,
      backend: 'openai',
      providerReason: 'content_filter',
      detail: detail || 'content_filter',
      model: model
    };
  }

  function openaiHttpError(response, bodyText, model) {
    var parsed = null;
    try { parsed = JSON.parse(bodyText || '{}'); } catch (e) { parsed = null; }
    var providerMessage =
      (parsed && parsed.error && parsed.error.message) ||
      (parsed && typeof parsed.error === 'string' ? parsed.error : null) ||
      response.statusText ||
      'HTTP ' + response.status;
    var base = {
      status: response.status,
      statusText: response.statusText,
      backend: 'openai',
      detail: providerMessage,
      model: model
    };

    if (/content_filter|content management policy/i.test(providerMessage)) {
      return Object.assign(base, openaiBlockedError(providerMessage, model));
    }
    if (response.status === 401 || response.status === 403) {
      return Object.assign(base, { code: 'auth_failed', message: 'OpenAI-compatible API key was rejected.', retryable: false });
    }
    if (response.status === 404) {
      return Object.assign(base, { code: 'invalid_args', message: 'Endpoint or model not found: ' + providerMessage, retryable: false });
    }
    if (response.status === 429) {
      return Object.assign(base, { code: 'rate_limit', message: 'OpenAI-compatible rate limit reached.', retryable: true });
    }
    if (response.status >= 500) {
      return Object.assign(base, { code: 'backend_failed', message: 'OpenAI-compatible service failed.', retryable: true });
    }
    if (response.status === 400) {
      return Object.assign(base, { code: 'invalid_args', message: providerMessage, retryable: false });
    }
    return Object.assign(base, { code: 'backend_failed', message: providerMessage, retryable: response.status >= 500 });
  }

  function extractOpenAiText(data, model) {
    var choice = Array.isArray(data && data.choices) ? data.choices[0] : null;
    if (choice && choice.finish_reason === 'content_filter') {
      throw openaiBlockedError(choice.finish_reason, model);
    }
    var text = choice && choice.message && typeof choice.message.content === 'string' ? choice.message.content : '';
    if (!text) {
      throw {
        code: 'invalid_response',
        message: 'OpenAI-compatible provider returned no message content.',
        retryable: false,
        backend: 'openai',
        model: model
      };
    }
    return text;
  }

  async function callOpenAiChatCompletion(settings, task) {
    if (!settings.configured) {
      throw {
        code: 'not_configured',
        message: 'The OpenAI-compatible backend needs a base URL and model.',
        retryable: false,
        backend: 'openai'
      };
    }

    var model = settings.model;
    var url = settings.baseUrl + '/chat/completions';
    var payloadInfo = openaiPayload(task, model);
    var headers = { 'Content-Type': 'application/json' };
    if (settings.apiKey) headers.Authorization = 'Bearer ' + settings.apiKey;

    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, GEMINI_DEFAULT_TIMEOUT_MS);
    try {
      var response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payloadInfo.payload),
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal
      });
      var bodyText = await response.text();
      if (!response.ok) {
        var httpError = openaiHttpError(response, bodyText, model);
        var retryAfter = response.headers.get('retry-after');
        if (retryAfter) {
          var seconds = Number(retryAfter);
          if (Number.isFinite(seconds)) httpError.retryAfterMs = Math.max(0, seconds * 1000);
        }
        throw httpError;
      }

      var data = null;
      try {
        data = JSON.parse(bodyText || '{}');
      } catch (parseError) {
        throw {
          code: 'invalid_response',
          message: 'OpenAI-compatible provider returned invalid JSON.',
          retryable: false,
          backend: 'openai',
          detail: (parseError && parseError.message) || 'invalid_json',
          model: model
        };
      }

      var text = extractOpenAiText(data, model);
      var result = {
        backend: 'openai',
        generatedAtIso: new Date().toISOString(),
        model: model,
        providerModel: data.model || model,
        usage: data.usage || null,
        status: openaiStatus(settings),
        text: text
      };
      openaiRuntimeState.lastModel = model;
      openaiRuntimeState.lastResolvedAtIso = result.generatedAtIso;

      if (task.output.type === 'json') {
        try {
          result.json = JSON.parse(text);
        } catch (jsonError) {
          throw {
            code: 'invalid_response',
            message: 'OpenAI-compatible provider returned invalid JSON text.',
            retryable: false,
            backend: 'openai',
            detail: (jsonError && jsonError.message) || 'invalid_json',
            model: model
          };
        }
      }
      return result;
    } catch (err) {
      if (err && err.name === 'AbortError') {
        throw {
          code: 'timeout',
          message: 'OpenAI-compatible query timed out after ' + GEMINI_DEFAULT_TIMEOUT_MS + ' ms.',
          retryable: true,
          backend: 'openai',
          model: model
        };
      }
      if (err && err.code) throw err;
      throw {
        code: 'backend_failed',
        message: (err && err.message) || 'OpenAI-compatible request failed.',
        retryable: true,
        backend: 'openai',
        model: model
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async function handleOpenAi(request) {
    request = request || {};
    var op = String(request.op || '').trim();
    if (op === 'settings:set') {
      var next = {};
      if (request.baseUrl !== undefined) next[OPENAI_STORAGE_KEYS.baseUrl] = normalizeOpenAiBaseUrl(request.baseUrl);
      if (request.apiKey !== undefined) next[OPENAI_STORAGE_KEYS.apiKey] = String(request.apiKey || '').trim();
      if (request.model !== undefined) next[OPENAI_STORAGE_KEYS.model] = normalizeOpenAiModel(request.model);
      await storageSetPromise(localStorageArea, next);
      openaiRuntimeState.lastModel = null;
      openaiRuntimeState.lastResolvedAtIso = null;
      return openaiStatus(await getOpenAiSettings());
    }
    var settings = await getOpenAiSettings();
    if (op === 'status') return openaiStatus(settings);
    if (op === 'test') {
      return callOpenAiChatCompletion(settings, normalizeGeminiTask({
        id: 'popup-test',
        prompt: 'Reply with exactly: BetterDungeon OpenAI ready',
        output: { type: 'text' }
      }));
    }
    if (op === 'query') return callOpenAiChatCompletion(settings, normalizeGeminiTask(request.task));
    throw { code: 'invalid_args', message: "OpenAI op '" + (op || '(empty)') + "' is not supported" };
  }

  window.__bdResolveNativeWebFetch = function (requestId, response) {
    var pending = nativeWebFetchPending[String(requestId || '')];
    if (!pending) return;
    delete nativeWebFetchPending[String(requestId || '')];
    clearTimeout(pending.timer);

    try {
      var envelope = typeof response === 'string' ? JSON.parse(response) : response;
      if (envelope && envelope.ok) pending.resolve(envelope.data);
      else pending.reject((envelope && envelope.error) || { code: 'webfetch_failed', message: 'Native WebFetch failed.' });
    } catch (error) {
      pending.reject({ code: 'webfetch_failed', message: 'Native WebFetch returned an invalid response.' });
    }
  };

  function handleWebFetch(request) {
    request = request || {};
    if (!window.BetterDungeonBridge || typeof window.BetterDungeonBridge.webFetch !== 'function') {
      return Promise.reject({ code: 'webfetch_unavailable', message: 'Native WebFetch bridge is unavailable.' });
    }

    var requestId = 'webfetch-' + Date.now().toString(36) + '-' + (++nativeWebFetchSequence).toString(36);
    var requestedTimeoutMs = Number(request.timeoutMs);
    var timeoutMs = Number.isFinite(requestedTimeoutMs)
      ? Math.max(1000, Math.min(requestedTimeoutMs, 30000))
      : 15000;
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        delete nativeWebFetchPending[requestId];
        reject({ code: 'timeout', message: 'WebFetch request timed out.' });
      }, timeoutMs + 1000);
      nativeWebFetchPending[requestId] = { resolve: resolve, reject: reject, timer: timer };

      try {
        window.BetterDungeonBridge.webFetch(JSON.stringify(request), requestId);
      } catch (error) {
        clearTimeout(timer);
        delete nativeWebFetchPending[requestId];
        reject({ code: 'webfetch_unavailable', message: (error && error.message) || 'Native WebFetch bridge failed.' });
      }
    });
  }

  async function handleSdk(request) {
    request = request || {};
    var op = String(request.op || '').trim();
    if (op !== 'config') throw { code: 'invalid_args', message: "SDK op '" + (op || '(empty)') + "' is not supported" };
    var sync = await storageGetPromise(syncStorageArea, Object.keys(SDK_SYNC_STORAGE_KEYS).map(function (k) {
      return SDK_SYNC_STORAGE_KEYS[k];
    }));
    var savedFeatures = isObject(sync[SDK_SYNC_STORAGE_KEYS.features]) ? sync[SDK_SYNC_STORAGE_KEYS.features] : {};
    var savedModules = isObject(sync[SDK_SYNC_STORAGE_KEYS.moduleStates]) ? sync[SDK_SYNC_STORAGE_KEYS.moduleStates] : {};
    var features = Object.assign({}, SDK_DEFAULT_FEATURES, savedFeatures);
    var modulePreferences = {};
    SDK_ULTRASCRIPTS_MODULES.forEach(function (moduleId) {
      modulePreferences[moduleId] = savedModules[moduleId] !== false;
    });
    return {
      features: features,
      ultrascripts: {
        debug: sync[SDK_SYNC_STORAGE_KEYS.debug] === true,
        modulePreferences: modulePreferences
      }
    };
  }

  function handleRuntimeMessage(message) {
    if (!message || typeof message !== 'object') return null;
    if (message.type === GEMINI_MESSAGE) return handleGemini(message.request);
    if (message.type === OPENAI_MESSAGE) return handleOpenAi(message.request);
    if (message.type === WEBFETCH_MESSAGE) return handleWebFetch(message.request);
    if (message.type === SDK_MESSAGE) return handleSdk(message.request);
    return null;
  }

  function runtimeSendMessage(message, callback) {
    var handled = handleRuntimeMessage(message);
    polyfilledChrome.runtime.lastError = undefined;
    if (handled) {
      return Promise.resolve(handled)
        .then(function (data) {
          var response = { ok: true, data: data };
          polyfilledChrome.runtime.lastError = undefined;
          if (typeof callback === 'function') callback(response);
          return response;
        })
        .catch(function (error) {
          var response = { ok: false, error: normalizeRuntimeError(error) };
          polyfilledChrome.runtime.lastError = undefined;
          if (typeof callback === 'function') callback(response);
          return response;
        });
    }
    window.__bdLastResponse = undefined;
    dispatchMessage(message, { id: 'betterdungeon-android' });
    return new Promise(function (resolve) {
      setTimeout(function () {
        var response = window.__bdLastResponse;
        if (typeof callback === 'function') callback(response);
        resolve(response);
      }, 50);
    });
  }

  function getAppVersion() {
    try {
      if (window.BetterDungeonBridge &&
          typeof window.BetterDungeonBridge.getAppVersion === 'function') {
        var version = window.BetterDungeonBridge.getAppVersion();
        if (version) return String(version);
      }
    } catch (e) {
      console.warn('[WebView Polyfill] Failed to get app version:', e);
    }
    return '0.0.0';
  }

  var polyfilledChrome = {
    runtime: {
      id: 'betterdungeon-android',
      lastError: undefined,
      getManifest: function () {
        return {
          name: 'BetterDungeon',
          version: getAppVersion()
        };
      },
      getURL: function (path) {
        // In the main WebView (https:// origin), file:/// URLs are blocked
        // by the browser security model. For image assets, use the native
        // bridge to return a base64 data URI instead.
        if (window.location.protocol === 'https:' &&
            window.BetterDungeonBridge &&
            typeof window.BetterDungeonBridge.getAssetDataUri === 'function' &&
            /\.(png|jpe?g|gif|svg|webp|ico)$/i.test(path)) {
          try {
            var dataUri = window.BetterDungeonBridge.getAssetDataUri(path);
            if (dataUri) return dataUri;
          } catch (e) {
            console.warn('[WebView Polyfill] Failed to get data URI for:', path);
          }
        }
        return 'file:///android_asset/betterdungeon/' + path;
      },
      sendMessage: function (messageOrExtensionId, messageOrCallback, optionsOrCallback, maybeCallback) {
        var message = typeof messageOrExtensionId === 'string' ? messageOrCallback : messageOrExtensionId;
        var callback = typeof messageOrCallback === 'function'
          ? messageOrCallback
          : (typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback);
        return runtimeSendMessage(message, callback);
      },
      onMessage: onMessageAPI
    },
    storage: {
      sync: syncStorageArea,
      local: localStorageArea,
      onChanged: {
        addListener: function (listener) {
          if (typeof listener === 'function' && storageChangeListeners.indexOf(listener) === -1) {
            storageChangeListeners.push(listener);
          }
        },
        removeListener: function (listener) {
          var idx = storageChangeListeners.indexOf(listener);
          if (idx !== -1) {
            storageChangeListeners.splice(idx, 1);
          }
        },
        hasListener: function (listener) {
          return storageChangeListeners.indexOf(listener) !== -1;
        }
      }
    },
    tabs: {
      query: function (queryInfo, callback) {
        // Always return a fake "current tab"
        var fakeTabs = [{
          id: 1,
          url: window.location.href,
          active: true,
          currentWindow: true
        }];
        if (typeof callback === 'function') {
          callback(fakeTabs);
        }
        return Promise.resolve(fakeTabs);
      },
      sendMessage: function (tabId, message, callbackOrOptions, maybeCallback) {
        var callback = typeof callbackOrOptions === 'function' ? callbackOrOptions : maybeCallback;

        // Reset last response
        window.__bdLastResponse = undefined;

        // Dispatch the message through the event bus
        dispatchMessage(message, { id: 'betterdungeon-android', tab: { id: tabId } });

        // Return a Promise and invoke the callback when ready
        return new Promise(function (resolve) {
          setTimeout(function () {
            var response = window.__bdLastResponse;
            if (typeof callback === 'function') {
              callback(response);
            }
            resolve(response);
          }, 50);
        });
      },
      create: function (props, callback) {
        // Open URL in system browser
        if (props && props.url) {
          try {
            window.BetterDungeonBridge.openExternalUrl(props.url);
          } catch (e) {
            window.open(props.url, '_blank');
          }
        }
        if (typeof callback === 'function') {
          callback({ id: 2, url: props ? props.url : '' });
        }
      }
    }
  };

  // Install the polyfill
  try {
    Object.defineProperty(globalThis, 'chrome', {
      value: polyfilledChrome,
      writable: true,
      configurable: true,
      enumerable: true
    });
  } catch (e) {
    try {
      globalThis.chrome = polyfilledChrome;
    } catch (e2) {
      window.chrome = polyfilledChrome;
    }
  }

  // Expose the in-page message dispatch function globally
  window.__bdDispatchMessage = dispatchMessage;

  // Cross-WebView dispatch: sendResponse routes back through the native bridge
  // instead of setting a global. Handles both sync and async message handlers.
  window.__bdDispatchMessageFromPopup = function (message, requestId) {
    var sender = { id: 'betterdungeon-popup' };

    for (var i = 0; i < messageListeners.length; i++) {
      try {
        var sendResponse = (function () {
          var called = false;
          return function (response) {
            if (!called) {
              called = true;
              try {
                window.BetterDungeonBridge.sendResponseToPopup(
                  JSON.stringify(response),
                  requestId
                );
              } catch (e) {
                console.error('[WebView Polyfill] Failed to send response to popup:', e);
              }
            }
          };
        })();

        var result = messageListeners[i](message, sender, sendResponse);
        // If listener returns true it will call sendResponse asynchronously —
        // the bridge callback handles that automatically.
      } catch (err) {
        console.error('[WebView Polyfill] Message listener error:', err);
      }
    }
  };

  console.log('[WebView Polyfill] Chrome API polyfill installed for Android WebView');
})();
