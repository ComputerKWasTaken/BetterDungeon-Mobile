package com.computerk.betterdungeon

import android.content.Context
import android.util.Log
import android.webkit.WebView
import java.io.BufferedReader
import java.io.InputStreamReader

/**
 * Handles injecting BetterDungeon extension scripts and styles into the WebView.
 *
 * Reads JS/CSS from the assets directory and evaluates them in the WebView
 * in the correct order, matching the original manifest.json content_scripts configuration.
 */
class InjectionEngine(private val context: Context) {

    companion object {
        private const val TAG = "BDInjection"
        private const val ASSET_BASE = "betterdungeon"

        /**
         * CSS files to inject, in order (from manifest.json content_scripts.css).
         */
        private val CSS_FILES = listOf(
            "core/theme-variables.css",
            "styles.css",
            "fonts/lucide/lucide.css"
        )

        /**
         * JS files to inject, in order (from manifest.json content_scripts.js).
         * The webview-polyfill replaces browser-polyfill and is injected FIRST.
         */
        private val JS_FILES = listOf(
            "utils/webview-polyfill.js",   // Must be first — sets up chrome.* shim
            "utils/dom.js",
            "utils/storage.js",
            "services/ai-dungeon-service.js",
            "services/loading-screen.js",
            "services/story-card-scanner.js",
            "core/feature-manager.js",
            "features/markdown_feature.js",
            "features/command_feature.js",
            "features/try_feature.js",
            "features/trigger_highlight_feature.js",
            "features/hotkey_feature.js",
            "features/plot_presets_feature.js",
            "features/input_mode_color_feature.js",
            "features/character_preset_feature.js",
            "features/auto_see_feature.js",
            "features/story_card_analytics_feature.js",
            "features/notes_feature.js",
            "features/auto_enable_scripts_feature.js",
            "features/story_card_modal_dock_feature.js",
            "features/better_scripts_feature.js",
            "features/input_history_feature.js",
            "main.js"
        )
    }

    // Cache loaded files to avoid re-reading from assets on every navigation
    private var cachedCss: String? = null
    private var cachedJs: String? = null

    /**
     * Inject all BetterDungeon CSS and JS into the given WebView.
     * Should be called from WebViewClient.onPageFinished() for aidungeon.com pages.
     */
    fun inject(webView: WebView) {
        Log.i(TAG, "Injecting BetterDungeon into WebView...")

        // Inject CSS first (non-blocking, just adds <style> tags)
        injectCss(webView)

        // Then inject JS
        injectJs(webView)
    }

    /**
     * Inject all CSS files as inline <style> blocks.
     */
    private fun injectCss(webView: WebView) {
        val css = getCombinedCss()
        if (css.isEmpty()) {
            Log.w(TAG, "No CSS to inject")
            return
        }

        // Escape for JavaScript string embedding
        val escapedCss = css
            .replace("\\", "\\\\")
            .replace("'", "\\'")
            .replace("\n", "\\n")
            .replace("\r", "")

        val injection = """
            (function() {
                var style = document.createElement('style');
                style.id = 'better-dungeon-styles';
                style.textContent = '$escapedCss';
                document.head.appendChild(style);
                console.log('[BetterDungeon] CSS injected');
            })();
        """.trimIndent()

        webView.evaluateJavascript(injection, null)
        Log.d(TAG, "CSS injected (${css.length} chars)")
    }

    /**
     * Inject all JS files concatenated together.
     */
    private fun injectJs(webView: WebView) {
        val js = getCombinedJs()
        if (js.isEmpty()) {
            Log.w(TAG, "No JS to inject")
            return
        }

        webView.evaluateJavascript(js) {
            Log.d(TAG, "JS injection complete")
        }
        Log.d(TAG, "JS injected (${js.length} chars)")
    }

    /**
     * Read and combine all CSS files from assets.
     */
    private fun getCombinedCss(): String {
        cachedCss?.let { return it }

        val combined = StringBuilder()
        for (file in CSS_FILES) {
            val content = readAsset("$ASSET_BASE/$file")
            if (content != null) {
                combined.append("/* === $file === */\n")
                combined.append(content)
                combined.append("\n\n")
            } else {
                Log.w(TAG, "CSS file not found: $file")
            }
        }

        // Fix font face URLs in CSS — convert relative paths to absolute asset paths
        var result = combined.toString()
        result = fixFontUrls(result)

        cachedCss = result
        return result
    }

    /**
     * Read and combine all JS files from assets.
     */
    private fun getCombinedJs(): String {
        cachedJs?.let { return it }

        val combined = StringBuilder()
        combined.append("(function() {\n'use strict';\n\n")

        for (file in JS_FILES) {
            val content = readAsset("$ASSET_BASE/$file")
            if (content != null) {
                combined.append("// ═══ $file ═══\n")
                combined.append("try {\n")
                combined.append(content)
                combined.append("\n} catch(e) { console.error('[BetterDungeon] Error in $file:', e); }\n\n")
            } else {
                Log.w(TAG, "JS file not found: $file")
            }
        }

        combined.append("\nconsole.log('[BetterDungeon] All scripts injected successfully');\n")
        combined.append("})();")

        cachedJs = combined.toString()
        return cachedJs!!
    }

    /**
     * Fix font URLs in CSS to point to android_asset paths.
     * Converts relative url() references to absolute file:///android_asset/ paths.
     */
    private fun fixFontUrls(css: String): String {
        // Replace url('lucide.woff2') style references in lucide.css
        // These are relative to the CSS file location (fonts/lucide/)
        var result = css

        // Fix lucide font references (relative to fonts/lucide/)
        result = result.replace(
            Regex("""url\(['"]?([^'")]+\.(woff2?|ttf|eot))['"]?\)""")
        ) { match ->
            val filename = match.groupValues[1]
            if (filename.startsWith("http") || filename.startsWith("file:") || filename.startsWith("data:")) {
                match.value // Leave absolute URLs alone
            } else {
                // Determine the correct path based on context
                val absolutePath = when {
                    filename.contains("/") -> "file:///android_asset/betterdungeon/$filename"
                    else -> "file:///android_asset/betterdungeon/fonts/lucide/$filename"
                }
                "url('$absolutePath')"
            }
        }

        return result
    }

    /**
     * Read a text file from assets.
     */
    private fun readAsset(path: String): String? {
        return try {
            val inputStream = context.assets.open(path)
            val reader = BufferedReader(InputStreamReader(inputStream))
            val content = reader.readText()
            reader.close()
            content
        } catch (e: Exception) {
            Log.e(TAG, "Failed to read asset: $path", e)
            null
        }
    }

    /**
     * Clear cached files (e.g., for development/debugging).
     */
    fun clearCache() {
        cachedCss = null
        cachedJs = null
    }
}
