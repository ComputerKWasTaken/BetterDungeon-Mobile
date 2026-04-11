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
        try {
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

          if (typeof callback === 'function') {
            callback(result);
            return;
          }
          // Return a Promise when no callback is provided (Manifest V3 style)
          return Promise.resolve(result);
        } catch (err) {
          console.error('[WebView Polyfill] storage.get error:', err);
          if (typeof callback === 'function') {
            callback({});
            return;
          }
          return Promise.resolve({});
        }
      },

      set: function (items, callback) {
        try {
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

          if (typeof callback === 'function') {
            callback();
            return;
          }
          return Promise.resolve();
        } catch (err) {
          console.error('[WebView Polyfill] storage.set error:', err);
          if (typeof callback === 'function') {
            callback();
            return;
          }
          return Promise.resolve();
        }
      },

      remove: function (keys, callback) {
        try {
          var keyList = typeof keys === 'string' ? [keys] : keys;
          for (var i = 0; i < keyList.length; i++) {
            window.BetterDungeonBridge.storageRemove(keyList[i]);
          }
          if (typeof callback === 'function') {
            callback();
            return;
          }
          return Promise.resolve();
        } catch (err) {
          console.error('[WebView Polyfill] storage.remove error:', err);
          if (typeof callback === 'function') {
            callback();
            return;
          }
          return Promise.resolve();
        }
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
