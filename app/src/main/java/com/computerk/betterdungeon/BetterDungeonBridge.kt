package com.computerk.betterdungeon

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebView

/**
 * JavaScript interface bridge exposed to the WebView as `BetterDungeonBridge`.
 *
 * Provides storage (SharedPreferences), URL opening, and cross-WebView
 * messaging that the webview-polyfill.js routes chrome.* API calls through.
 */
class BetterDungeonBridge(private val context: Context) {

    companion object {
        const val JS_INTERFACE_NAME = "BetterDungeonBridge"
        private const val PREFS_NAME = "betterdungeon_storage"
    }

    private val prefs: SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private val mainHandler = Handler(Looper.getMainLooper())

    // References set by MainActivity after initialization
    var mainWebView: WebView? = null
    var popupWebView: WebView? = null
    var onClosePopup: (() -> Unit)? = null
    var onShowPopup: (() -> Unit)? = null

    // ── Storage ───────────────────────────────────────────────────────

    @JavascriptInterface
    fun storageGet(key: String): String {
        return prefs.getString(key, "") ?: ""
    }

    @JavascriptInterface
    fun storageGetAll(): String {
        val all = prefs.all
        val sb = StringBuilder("{")
        var first = true
        for ((key, value) in all) {
            if (!first) sb.append(",")
            first = false
            sb.append("\"").append(escapeJsonString(key)).append("\":")
            if (value is String) {
                sb.append(value)
            } else {
                sb.append("\"").append(escapeJsonString(value.toString())).append("\"")
            }
        }
        sb.append("}")
        return sb.toString()
    }

    @JavascriptInterface
    fun storageSet(key: String, value: String) {
        prefs.edit().putString(key, value).apply()
    }

    @JavascriptInterface
    fun storageRemove(key: String) {
        prefs.edit().remove(key).apply()
    }

    // ── Cross-WebView Messaging ───────────────────────────────────────

    /**
     * Called from the popup WebView to send a message to the main WebView's
     * content scripts. The message is dispatched through the event bus.
     */
    @JavascriptInterface
    fun forwardToMainWebView(messageJson: String) {
        mainHandler.post {
            mainWebView?.evaluateJavascript(
                """
                (function() {
                    var message = $messageJson;
                    if (window.__bdDispatchMessageFromPopup) {
                        window.__bdDispatchMessageFromPopup(message);
                    } else if (window.__bdDispatchMessage) {
                        window.__bdDispatchMessage(message, { id: 'betterdungeon-popup' });
                    }
                })();
                """.trimIndent(),
                null
            )
        }
    }

    /**
     * Called from the main WebView to send a response back to the popup.
     */
    @JavascriptInterface
    fun sendResponseToPopup(responseJson: String) {
        mainHandler.post {
            popupWebView?.evaluateJavascript(
                """
                (function() {
                    if (window.__bdPopupCallback) {
                        var response = $responseJson;
                        window.__bdPopupCallback(response);
                        window.__bdPopupCallback = null;
                    }
                })();
                """.trimIndent(),
                null
            )
        }
    }

    /**
     * Close the popup panel (called from popup's window.close()).
     */
    @JavascriptInterface
    fun closePopup() {
        mainHandler.post {
            onClosePopup?.invoke()
        }
    }

    /**
     * Open the popup panel (called from the main webview's DOM).
     */
    @JavascriptInterface
    fun showPopup() {
        mainHandler.post {
            onShowPopup?.invoke()
        }
    }

    // ── URL handling ──────────────────────────────────────────────────

    @JavascriptInterface
    fun openExternalUrl(url: String) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        } catch (e: Exception) {
            // Silently fail if no browser is available
        }
    }

    // ── Utilities ─────────────────────────────────────────────────────

    @JavascriptInterface
    fun getAppVersion(): String {
        return try {
            val pInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            pInfo.versionName ?: "1.0"
        } catch (e: Exception) {
            "1.0"
        }
    }

    @JavascriptInterface
    fun log(message: String) {
        android.util.Log.d("BetterDungeon", message)
    }

    // ── Private helpers ───────────────────────────────────────────────

    private fun escapeJsonString(str: String): String {
        return str
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t")
    }
}
