package com.uzcam.app

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Bundle
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.uzcam.app.web.UzCamWebChromeClient
import com.uzcam.app.web.UzCamWebViewClient

class MainActivity : ComponentActivity() {

    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    private val filePickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val resultUris = if (result.resultCode == RESULT_OK) {
            val intent = result.data
            if (intent?.data != null) {
                arrayOf(intent.data!!)
            } else if (intent?.clipData != null) {
                val clipData = intent.clipData!!
                Array(clipData.itemCount) { i -> clipData.getItemAt(i).uri }
            } else {
                null
            }
        } else {
            null
        }
        filePathCallback?.onReceiveValue(resultUris)
        filePathCallback = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            UzCamAppTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    UzCamAppScreen(
                        baseUrl = "https://texnocam-miniapp.onrender.com",
                        onOpenFileChooser = { callback, params ->
                            filePathCallback?.onReceiveValue(null)
                            filePathCallback = callback
                            val intent = params?.createIntent()
                            if (intent != null) {
                                try {
                                    filePickerLauncher.launch(intent)
                                    true
                                } catch (e: Exception) {
                                    filePathCallback = null
                                    false
                                }
                            } else {
                                filePathCallback = null
                                false
                            }
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun UzCamAppTheme(content: @Composable () -> Unit) {
    val emeraldColor = Color(0xFF059669)
    val lightColorScheme = lightColorScheme(
        primary = emeraldColor,
        secondary = Color(0xFF047857),
        background = Color(0xFFF8FAFC),
        surface = Color.White
    )
    MaterialTheme(
        colorScheme = lightColorScheme,
        content = content
    )
}

@Composable
fun UzCamAppScreen(
    baseUrl: String,
    onOpenFileChooser: (ValueCallback<Array<Uri>>?, WebChromeClient.FileChooserParams?) -> Boolean
) {
    val context = LocalContext.current
    var webViewInstance by remember { mutableStateOf<WebView?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var progress by remember { mutableStateOf(0) }
    var isError by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf("") }

    val isNetworkAvailable = remember {
        mutableStateOf(checkNetworkAvailable(context))
    }

    BackHandler(enabled = webViewInstance?.canGoBack() == true && !isError) {
        webViewInstance?.goBack()
    }

    Column(modifier = Modifier.fillMaxSize()) {
        if (isLoading && !isError) {
            LinearProgressIndicator(
                progress = { progress / 100f },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(3.dp),
                color = MaterialTheme.colorScheme.primary,
                trackColor = Color(0xFFD1FAE5)
            )
        }

        if (isError || !isNetworkAvailable.value) {
            OfflineErrorScreen(
                message = if (!isNetworkAvailable.value) "Internetga ulanib bo‘lmadi" else errorMessage,
                onRetry = {
                    isNetworkAvailable.value = checkNetworkAvailable(context)
                    if (isNetworkAvailable.value) {
                        isError = false
                        isLoading = true
                        webViewInstance?.reload()
                    }
                }
            )
        } else {
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { ctx ->
                    WebView(ctx).apply {
                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true
                        settings.databaseEnabled = true
                        settings.allowFileAccess = true
                        settings.useWideViewPort = true
                        settings.loadWithOverviewMode = true
                        settings.userAgentString = settings.userAgentString + " UzCamAndroidApp/1.0"

                        webViewClient = UzCamWebViewClient(
                            context = ctx,
                            onErrorReceived = { err ->
                                isError = true
                                errorMessage = err
                                isLoading = false
                            },
                            onPageFinishedLoading = {
                                isLoading = false
                            }
                        )

                        webChromeClient = UzCamWebChromeClient(
                            onProgressChanged = { newProgress ->
                                progress = newProgress
                                if (newProgress >= 100) {
                                    isLoading = false
                                }
                            },
                            onFileChooser = onOpenFileChooser
                        )

                        loadUrl(baseUrl)
                        webViewInstance = this
                    }
                },
                update = { webView ->
                    webViewInstance = webView
                }
            )
        }
    }
}

@Composable
fun OfflineErrorScreen(
    message: String,
    onRetry: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF8FAFC))
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = "📡",
                fontSize = 54.sp,
                modifier = Modifier.padding(bottom = 16.dp)
            )
            Text(
                text = "Ulanishda xatolik",
                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                color = Color(0xFF111827),
                modifier = Modifier.padding(bottom = 8.dp)
            )
            Text(
                text = message.ifEmpty { "UzCam serveriga ulanib bo‘lmadi. Internet tarmoq aloqasini tekshiring." },
                style = MaterialTheme.typography.bodyMedium,
                color = Color(0xFF6B7280),
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(bottom = 24.dp)
            )
            Button(
                onClick = onRetry,
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
            ) {
                Text("Qayta urinib ko‘rish", color = Color.White, fontWeight = FontWeight.Bold)
            }
        }
    }
}

private fun checkNetworkAvailable(context: Context): Boolean {
    val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
    val network = connectivityManager?.activeNetwork ?: return false
    val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
    return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
}
