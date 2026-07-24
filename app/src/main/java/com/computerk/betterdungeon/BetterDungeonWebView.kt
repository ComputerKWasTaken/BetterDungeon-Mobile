package com.computerk.betterdungeon

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Rect
import android.util.AttributeSet
import android.view.View
import android.webkit.WebView

/**
 * WebView that filters Chromium's caret-following requests.
 *
 * Some WebView releases call requestRectangleOnScreen() every time the text
 * cursor moves. In this app the WebView already fills its non-scrolling parent,
 * so forwarding a source-less request can only move the activity window and
 * causes tall editors to snap downward.
 */
class BetterDungeonWebView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = android.R.attr.webViewStyle
) : WebView(context, attrs, defStyleAttr) {

    /**
     * Chromium uses this overload before Android 16 QPR1, where the request
     * source was not available and treats these calls as caret moves. Reject it
     * unconditionally so a request made during IME opening cannot slip through.
     */
    override fun requestRectangleOnScreen(rectangle: Rect): Boolean = false

    override fun requestRectangleOnScreen(rectangle: Rect, immediate: Boolean): Boolean = false

    /**
     * Also cover WebView providers that issue the request from an internal
     * content child instead of from the public WebView instance.
     */
    override fun requestChildRectangleOnScreen(
        child: View,
        rectangle: Rect,
        immediate: Boolean
    ): Boolean = false

    /**
     * Android 16 QPR1 identifies caret requests explicitly, so these can be
     * filtered without relying on keyboard state.
     *
     * The overload only exists on newer Android versions. Defining an override
     * is safe on older devices because the framework cannot dispatch to it.
     */
    @SuppressLint("NewApi")
    override fun requestRectangleOnScreen(
        rectangle: Rect,
        immediate: Boolean,
        source: Int
    ): Boolean {
        if (source == View.RECTANGLE_ON_SCREEN_REQUEST_SOURCE_TEXT_CURSOR) {
            return false
        }
        return super.requestRectangleOnScreen(rectangle, immediate, source)
    }

    @SuppressLint("NewApi")
    override fun requestChildRectangleOnScreen(
        child: View,
        rectangle: Rect,
        immediate: Boolean,
        source: Int
    ): Boolean {
        if (source == View.RECTANGLE_ON_SCREEN_REQUEST_SOURCE_TEXT_CURSOR) {
            return false
        }
        return super.requestChildRectangleOnScreen(child, rectangle, immediate, source)
    }
}
