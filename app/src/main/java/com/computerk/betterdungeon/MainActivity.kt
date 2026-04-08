package com.computerk.betterdungeon

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.View
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.view.ViewGroup.MarginLayoutParams
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat

/**
 * Main activity that hosts the AI Dungeon WebView and injects BetterDungeon.
 *
 * Architecture:
 * - Primary WebView loads play.aidungeon.com
 * - InjectionEngine injects all extension CSS/JS on page load
 * - BetterDungeonBridge provides @JavascriptInterface for storage + utilities
 * - Bottom sheet with secondary WebView hosts the popup UI
 * - FAB toggles the popup panel
 */
class MainActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "BetterDungeon"
        private const val AI_DUNGEON_URL = "https://play.aidungeon.com"
    }

    private lateinit var mainWebView: WebView
    private lateinit var popupWebView: WebView
    private lateinit var popupContainer: FrameLayout

    private lateinit var bridge: BetterDungeonBridge
    private lateinit var injectionEngine: InjectionEngine

    private var popupLoaded = false

    // ── Lifecycle ─────────────────────────────────────────────────────

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Edge-to-edge rendering
        WindowCompat.setDecorFitsSystemWindows(window, false)

        setContentView(R.layout.activity_main)

        // Apply window insets to popup so it isn't hidden by system bars
        popupContainer = findViewById(R.id.popup_container)

        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main_container)) { _, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            
            // Apply padding to popup container so its WebView isn't under system bars
            popupContainer.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            
            // Note: We intentionally DO NOT pad the main Webview or the main_container itself
            // so that AI Dungeon can take up the full height of the screen like a native app.
            
            insets
        }

        // Initialize components
        bridge = BetterDungeonBridge(this)
        injectionEngine = InjectionEngine(this)

        setupMainWebView()
        setupPopupWebView()
        setupBackNavigation()

        // Wire up bridge references for cross-WebView communication
        bridge.mainWebView = mainWebView
        bridge.popupWebView = popupWebView
        bridge.onClosePopup = {
            hidePopup()
        }
        bridge.onShowPopup = {
            togglePopup()
        }

        // Load AI Dungeon
        mainWebView.loadUrl(AI_DUNGEON_URL)
        Log.i(TAG, "Loading AI Dungeon...")
    }

    override fun onDestroy() {
        mainWebView.destroy()
        popupWebView.destroy()
        super.onDestroy()
    }

    // ── Main WebView ──────────────────────────────────────────────────

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupMainWebView() {
        mainWebView = findViewById(R.id.webview_main)

        mainWebView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            cacheMode = WebSettings.LOAD_DEFAULT
            useWideViewPort = true
            loadWithOverviewMode = true
            setSupportZoom(true)
            builtInZoomControls = true
            displayZoomControls = false

            // Enable modern web features
            mediaPlaybackRequiresUserGesture = false

            // User agent: append BetterDungeon identifier
            userAgentString = "$userAgentString BetterDungeon/1.0"
        }

        // Allow file access from file URLs (needed for asset loading)
        @Suppress("DEPRECATION")
        mainWebView.settings.allowFileAccessFromFileURLs = true
        @Suppress("DEPRECATION")
        mainWebView.settings.allowUniversalAccessFromFileURLs = true

        // Add the JavaScript interface bridge
        mainWebView.addJavascriptInterface(bridge, BetterDungeonBridge.JS_INTERFACE_NAME)

        mainWebView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                Log.d(TAG, "Page loaded: $url")

                // Only inject on AI Dungeon pages
                if (url.contains("aidungeon.com")) {
                    injectionEngine.inject(view)
                }
            }

            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                val url = request.url.toString()

                // Keep AI Dungeon navigation inside the WebView
                if (url.contains("aidungeon.com")) {
                    return false
                }

                // Open external links in system browser
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to open external URL: $url", e)
                }
                return true
            }
        }

        mainWebView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean {
                val level = when (consoleMessage.messageLevel()) {
                    ConsoleMessage.MessageLevel.ERROR -> "E"
                    ConsoleMessage.MessageLevel.WARNING -> "W"
                    else -> "D"
                }
                Log.println(
                    when (level) {
                        "E" -> Log.ERROR
                        "W" -> Log.WARN
                        else -> Log.DEBUG
                    },
                    "BDWebView",
                    "${consoleMessage.message()} (${consoleMessage.sourceId()}:${consoleMessage.lineNumber()})"
                )
                return true
            }
        }
    }

    // ── Popup WebView ─────────────────────────────────────────────────

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupPopupWebView() {
        popupWebView = findViewById(R.id.webview_popup)

        popupWebView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            allowContentAccess = true
        }

        @Suppress("DEPRECATION")
        popupWebView.settings.allowFileAccessFromFileURLs = true
        @Suppress("DEPRECATION")
        popupWebView.settings.allowUniversalAccessFromFileURLs = true

        // Share the same bridge instance
        popupWebView.addJavascriptInterface(bridge, BetterDungeonBridge.JS_INTERFACE_NAME)

        popupWebView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                Log.d(TAG, "Popup loaded: $url")

                // Inject the popup-to-content-script bridge
                injectPopupBridge(view)
            }

            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                val url = request.url.toString()
                // Open any links from popup in system browser
                if (!url.startsWith("file:")) {
                    try {
                        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                    } catch (e: Exception) {
                        Log.w(TAG, "Failed to open URL from popup: $url", e)
                    }
                    return true
                }
                return false
            }
        }

        popupWebView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean {
                Log.d(
                    "BDPopup",
                    "${consoleMessage.message()} (${consoleMessage.sourceId()}:${consoleMessage.lineNumber()})"
                )
                return true
            }
        }
    }

    /**
     * Load the popup HTML from assets.
     */
    private fun loadPopup() {
        if (!popupLoaded) {
            popupWebView.loadUrl("file:///android_asset/betterdungeon/popup.html")
            popupLoaded = true
        }
    }

    /**
     * Inject a bridge script into the popup WebView that routes
     * chrome.tabs.sendMessage calls to the main WebView.
     *
     * The popup uses chrome.tabs.query + chrome.tabs.sendMessage to
     * communicate with content scripts. We intercept these in the popup
     * and forward them to the main WebView via evaluateJavascript.
     */
    private fun injectPopupBridge(popupView: WebView) {
        // First, inject the webview polyfill into the popup too
        val polyfillJs = try {
            assets.open("betterdungeon/utils/webview-polyfill.js")
                .bufferedReader().readText()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to read webview-polyfill.js for popup", e)
            return
        }

        popupView.evaluateJavascript(polyfillJs, null)

        // Now override chrome.tabs.sendMessage to forward to main WebView
        val bridgeScript = """
            (function() {
                var originalSendMessage = chrome.tabs.sendMessage;
                
                chrome.tabs.sendMessage = function(tabId, message, optionsOrCallback, maybeCallback) {
                    var callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
                    
                    // Forward the message to the main WebView via the bridge
                    var messageJson = JSON.stringify(message);
                    BetterDungeonBridge.log('Popup sending message: ' + message.type);
                    
                    // Use Android bridge to forward to main WebView
                    window.__bdPopupCallback = callback;
                    window.__bdPopupMessageJson = messageJson;
                    
                    // The native side will call evaluateJavascript on the main WebView
                    BetterDungeonBridge.forwardToMainWebView(messageJson);
                };
                
                // Override window.close() to collapse the bottom sheet
                window.close = function() {
                    BetterDungeonBridge.closePopup();
                };
                
                console.log('[BetterDungeon] Popup bridge injected');
            })();
        """.trimIndent()

        popupView.evaluateJavascript(bridgeScript, null)
    }

    // ── Full Screen Popup ─────────────────────────────────────────────

    private fun togglePopup() {
        if (popupContainer.visibility == View.GONE) {
            loadPopup()
            showPopup()
        } else {
            hidePopup()
        }
    }
    
    private fun showPopup() {
        popupContainer.visibility = View.VISIBLE
    }
    
    private fun hidePopup() {
        popupContainer.visibility = View.GONE
    }

    // ── Back Navigation ───────────────────────────────────────────────

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                when {
                    // Close popup first if open
                    popupContainer.visibility == View.VISIBLE -> {
                        hidePopup()
                    }
                    // Then navigate back in WebView
                    mainWebView.canGoBack() -> {
                        mainWebView.goBack()
                    }
                    // Finally, let the system handle it (exit app)
                    else -> {
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                    }
                }
            }
        })
    }
}