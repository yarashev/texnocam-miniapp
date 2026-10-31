package com.uzcam.app.web

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient

class UzCamWebViewClient(
    private val context: Context,
    private val onErrorReceived: (String) -> Unit,
    private val onPageFinishedLoading: () -> Unit
) : WebViewClient() {

    override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
        val url = request?.url?.toString() ?: return false

        if (url.startsWith("tel:") || url.startsWith("mailto:") || url.startsWith("https://t.me/") || url.startsWith("tg:")) {
            try {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                context.startActivity(intent)
                return true
            } catch (e: Exception) {
                // If no handler is available for deep link, let webview handle it
                return false
            }
        }

        if (url.startsWith("intent://")) {
            try {
                val intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
                if (intent != null) {
                    context.startActivity(intent)
                    return true
                }
            } catch (e: Exception) {
                // Fallback handling if needed
            }
            return true
        }

        return false
    }

    override fun onPageFinished(view: WebView?, url: String?) {
        super.onPageFinished(view, url)
        onPageFinishedLoading()
    }

    override fun onReceivedError(
        view: WebView?,
        request: WebResourceRequest?,
        error: WebResourceError?
    ) {
        super.onReceivedError(view, request, error)
        if (request?.isForMainFrame == true) {
            val description = error?.description?.toString() ?: "Xizmatga ulanib bo‘lmadi"
            onErrorReceived(description)
        }
    }
}
