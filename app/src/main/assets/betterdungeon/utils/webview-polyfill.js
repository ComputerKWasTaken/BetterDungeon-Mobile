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
  var GEMINI_DEFAULT_MODEL = 'gemini-3.5-flash';
  var GEMINI_DEFAULT_MODEL_MODE = 'auto';
  var GEMINI_DEFAULT_TIMEOUT_MS = 120000;
  var GEMINI_PROMPT_MAX_CHARS = 12000;
  var GEMINI_THINKING_LEVELS = ['minimal', 'low', 'medium', 'high'];
  var GEMINI_OUTPUT_TYPES = ['text', 'json'];
  var GEMINI_AUTO_STEPDOWN_MODELS = [
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemma-4-31b-it',
    'gemma-4-26b-a4b-it'
  ];
  var GEMINI_STORAGE_KEYS = {
    apiKey: 'ultrascripts_ai_gemini_api_key',
    model: 'ultrascripts_ai_gemini_model',
    modelMode: 'ultrascripts_ai_gemini_model_mode'
  };
  var SDK_SYNC_STORAGE_KEYS = {
    features: 'betterDungeonFeatures',
    moduleStates: 'ultrascripts_enabled_modules',
    webfetchAllowlist: 'ultrascripts_webfetch_allowlist',
    debug: 'ultrascripts_debug'
  };
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
        detail: error.detail,
        backend: error.backend,
        model: error.model
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

  function geminiPayload(task) {
    var generationConfig = {};
    if (task.output.type === 'json') {
      generationConfig.responseMimeType = 'application/json';
      generationConfig.responseJsonSchema = task.output.schema;
    }
    var payload = { contents: [{ role: 'user', parts: [{ text: task.prompt }] }] };
    if (Object.keys(generationConfig).length) payload.generationConfig = generationConfig;
    return payload;
  }

  function extractGeminiText(data) {
    var candidates = Array.isArray(data && data.candidates) ? data.candidates : [];
    if (!candidates.length) {
      var blockReason = data && data.promptFeedback && data.promptFeedback.blockReason;
      throw {
        code: blockReason ? 'blocked' : 'invalid_response',
        message: blockReason ? 'Gemini blocked the prompt: ' + blockReason : 'Gemini returned no candidates.',
        backend: 'gemini'
      };
    }
    var parts = Array.isArray(candidates[0] && candidates[0].content && candidates[0].content.parts)
      ? candidates[0].content.parts
      : [];
    var text = parts.map(function (part) {
      return !part.thought && typeof part.text === 'string' ? part.text : '';
    }).filter(Boolean).join('');
    if (!text) throw { code: 'invalid_response', message: 'Gemini returned no text output.', backend: 'gemini' };
    return text;
  }

  function geminiHttpError(response, bodyText) {
    var parsed = null;
    try { parsed = JSON.parse(bodyText || '{}'); } catch (e) { parsed = null; }
    var providerMessage = (parsed && parsed.error && parsed.error.message) || response.statusText || 'HTTP ' + response.status;
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

  async function callGeminiGenerateContent(settings, task) {
    if (!settings.keyConfigured) {
      throw { code: 'not_configured', message: 'No Gemini API key is configured.', backend: 'gemini' };
    }
    var models = geminiQueryModels(settings);
    var lastError = null;
    for (var i = 0; i < models.length; i++) {
      var model = models[i];
      var controller = new AbortController();
      var timer = setTimeout(function () { controller.abort(); }, GEMINI_DEFAULT_TIMEOUT_MS);
      try {
        var response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': settings.apiKey
          },
          body: JSON.stringify(geminiPayload(task)),
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
        var data = JSON.parse(bodyText || '{}');
        var text = extractGeminiText(data);
        var result = {
          backend: 'gemini',
          generatedAtIso: new Date().toISOString(),
          model: model,
          providerModel: data.modelVersion || model,
          usage: data.usageMetadata || null,
          status: geminiStatus(settings, model),
          thinking: {
            requestedLevel: task.thinking.level,
            applied: false,
            family: 'unknown',
            defaulted: task.thinking.level === 'minimal'
          },
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
        if (task.output.type === 'json') result.json = JSON.parse(text);
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
      return callGeminiGenerateContent(settings, normalizeGeminiTask({
        id: 'popup-test',
        prompt: 'Reply with exactly: BetterDungeon Gemini ready',
        output: { type: 'text' }
      }));
    }
    if (op === 'query') return callGeminiGenerateContent(settings, normalizeGeminiTask(request.task));
    throw { code: 'invalid_args', message: "Gemini op '" + (op || '(empty)') + "' is not supported" };
  }

  async function handleWebFetch(request) {
    request = request || {};
    var url = String(request.url || '').trim();
    if (!/^https?:\/\//i.test(url)) throw { code: 'invalid_url', message: 'WebFetch requires an http or https URL.' };
    var method = String(request.method || 'GET').toUpperCase();
    if (['GET', 'HEAD', 'OPTIONS'].indexOf(method) === -1) {
      throw { code: 'method_not_allowed', message: 'WebFetch supports GET, HEAD, and OPTIONS only.' };
    }
    var timeoutMs = Math.max(1000, Math.min(Number(request.timeoutMs || 15000), 30000));
    var maxBodyBytes = Math.max(0, Math.min(Number(request.maxBodyBytes || 50000), 200000));
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, timeoutMs);
    try {
      var response = await fetch(url, {
        method: method,
        headers: isObject(request.headers) ? request.headers : undefined,
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal
      });
      var headers = {};
      response.headers.forEach(function (value, key) { headers[key] = value; });
      var body = '';
      var truncated = false;
      if (method !== 'HEAD') {
        body = await response.text();
        if (body.length > maxBodyBytes) {
          body = body.slice(0, maxBodyBytes);
          truncated = true;
        }
      }
      return {
        url: response.url || url,
        status: response.status,
        ok: response.ok,
        statusText: response.statusText,
        headers: headers,
        bodyEncoding: 'text',
        body: body,
        truncated: truncated,
        request: { method: method, strippedHeaders: [] }
      };
    } catch (err) {
      if (err && err.name === 'AbortError') throw { code: 'timeout', message: 'WebFetch request timed out.', retryable: true };
      throw { code: 'webfetch_failed', message: (err && err.message) || 'WebFetch failed.', retryable: true };
    } finally {
      clearTimeout(timer);
    }
  }

  async function handleSdk(request) {
    request = request || {};
    var op = String(request.op || '').trim();
    if (op !== 'config') throw { code: 'invalid_args', message: "SDK op '" + (op || '(empty)') + "' is not supported" };
    var sync = await storageGetPromise(syncStorageArea, Object.keys(SDK_SYNC_STORAGE_KEYS).map(function (k) {
      return SDK_SYNC_STORAGE_KEYS[k];
    }));
    var features = isObject(sync[SDK_SYNC_STORAGE_KEYS.features]) ? sync[SDK_SYNC_STORAGE_KEYS.features] : {};
    var modules = isObject(sync[SDK_SYNC_STORAGE_KEYS.moduleStates]) ? sync[SDK_SYNC_STORAGE_KEYS.moduleStates] : {};
    var allowlist = isObject(sync[SDK_SYNC_STORAGE_KEYS.webfetchAllowlist]) ? sync[SDK_SYNC_STORAGE_KEYS.webfetchAllowlist] : {};
    return {
      platform: 'android-webview',
      features: features,
      ultrascripts: {
        enabled: features.ultrascripts !== false,
        debug: sync[SDK_SYNC_STORAGE_KEYS.debug] === true,
        modules: modules
      },
      webfetch: {
        consentOrigins: Object.keys(allowlist).length
      }
    };
  }

  function handleRuntimeMessage(message) {
    if (!message || typeof message !== 'object') return null;
    if (message.type === GEMINI_MESSAGE) return handleGemini(message.request);
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

  var polyfilledChrome = {
    runtime: {
      id: 'betterdungeon-android',
      lastError: undefined,
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
  window.__bdDispatchMessageFromPopup = function (message) {
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
                  JSON.stringify(response)
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
