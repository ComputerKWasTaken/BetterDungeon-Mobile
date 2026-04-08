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

  // ── Storage Bridge ──────────────────────────────────────────────────
  // Uses the native BetterDungeonBridge exposed via @JavascriptInterface

  function createStorageArea() {
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
          }
        } catch (err) {
          console.error('[WebView Polyfill] storage.get error:', err);
          if (typeof callback === 'function') {
            callback({});
          }
        }
      },

      set: function (items, callback) {
        try {
          var itemKeys = Object.keys(items);
          for (var i = 0; i < itemKeys.length; i++) {
            var key = itemKeys[i];
            var value = JSON.stringify(items[key]);
            window.BetterDungeonBridge.storageSet(key, value);
          }

          if (typeof callback === 'function') {
            callback();
          }
        } catch (err) {
          console.error('[WebView Polyfill] storage.set error:', err);
          if (typeof callback === 'function') {
            callback();
          }
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
          }
        } catch (err) {
          console.error('[WebView Polyfill] storage.remove error:', err);
          if (typeof callback === 'function') {
            callback();
          }
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

  var storageArea = createStorageArea();

  var polyfilledChrome = {
    runtime: {
      id: 'betterdungeon-android',
      lastError: undefined,
      getURL: function (path) {
        return 'file:///android_asset/betterdungeon/' + path;
      },
      onMessage: onMessageAPI
    },
    storage: {
      sync: storageArea,
      local: storageArea,
      onChanged: {
        addListener: function () { /* no-op for now */ },
        removeListener: function () { /* no-op */ },
        hasListener: function () { return false; }
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

        // Give async listeners a moment, then call back
        if (typeof callback === 'function') {
          setTimeout(function () {
            callback(window.__bdLastResponse);
          }, 50);
        }
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

  // Also expose the message dispatch function globally so popup can use it
  window.__bdDispatchMessage = dispatchMessage;

  console.log('[WebView Polyfill] Chrome API polyfill installed for Android WebView');
})();
