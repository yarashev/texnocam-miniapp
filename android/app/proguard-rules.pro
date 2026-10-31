# Keep Javascript interface methods for WebEngine
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
