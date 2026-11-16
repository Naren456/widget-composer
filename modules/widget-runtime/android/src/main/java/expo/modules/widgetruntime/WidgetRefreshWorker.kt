package expo.modules.widgetruntime

import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

class WidgetRefreshWorker(context: Context, parameters: WorkerParameters) : Worker(context, parameters) {
  override fun doWork(): Result {
    val widgetId = inputData.getString(KEY_WIDGET_ID)?.takeIf(String::isNotBlank)
      ?: return Result.failure(workDataOf(KEY_ERROR to "Missing widget id"))
    val store = WidgetStore(applicationContext)
    val credentials = store.backgroundRefreshCredentials()
      ?: return fail(widgetId, "Background refresh is not configured; open WidgetComposer once and try again.")

    return try {
      var accessToken = credentials.accessToken
      var response = request(widgetDataUrl(credentials.apiBaseUrl, widgetId), accessToken)
      if (response.status == 401) {
        val refreshed = refreshCredentials(credentials.apiBaseUrl, credentials.refreshToken)
        accessToken = refreshed.first
        store.updateBackgroundRefreshTokens(refreshed.first, refreshed.second)
        response = request(widgetDataUrl(credentials.apiBaseUrl, widgetId), accessToken)
        if (response.status == 401) {
          store.clearBackgroundRefreshCredentials()
          return fail(widgetId, "Your WidgetComposer session expired. Open the app to sign in again.")
        }
      }
      if (response.status == 429 || response.status in 500..599) {
        Log.w(ComposerWidgetProvider.TAG, "Widget $widgetId refresh received HTTP ${response.status}; retrying.")
        return Result.retry()
      }
      if (response.status !in 200..299) return fail(widgetId, "Widget data API returned HTTP ${response.status}.")

      val responseJson = JSONObject(response.body)
      val lastErrorValue = responseJson.opt("lastError")
      val lastError = when (lastErrorValue) {
        null, JSONObject.NULL -> null
        is String -> lastErrorValue.takeIf(String::isNotBlank)
        else -> return fail(widgetId, "Widget data API returned an invalid refresh error.")
      }
      if (lastError != null) return fail(widgetId, "Widget data could not be refreshed: $lastError")
      val data = responseJson.optJSONObject("data")
        ?: return fail(widgetId, "Widget data API returned no data.")
      store.updateWidgetData(widgetId, data)
      GlanceWidgetUpdates.updateAll(applicationContext)
      Log.i(ComposerWidgetProvider.TAG, "Widget $widgetId refreshed in the background.")
      Result.success()
    } catch (error: RefreshSessionRejectedException) {
      store.clearBackgroundRefreshCredentials()
      fail(widgetId, error.message ?: "Your WidgetComposer session expired. Open the app to sign in again.")
    } catch (error: IOException) {
      Log.w(ComposerWidgetProvider.TAG, "Widget $widgetId refresh could not reach the API; retrying.", error)
      Result.retry()
    } catch (error: Exception) {
      Log.e(ComposerWidgetProvider.TAG, "Widget $widgetId background refresh failed.", error)
      Result.failure(workDataOf(KEY_ERROR to (error.message ?: "Background refresh failed.")))
    }
  }

  private fun request(url: String, accessToken: String): HttpResponse =
    httpRequest(url, "GET", "Bearer $accessToken")

  private fun refreshCredentials(apiBaseUrl: String, refreshToken: String): Pair<String, String> {
    val response = httpRequest(
      "$apiBaseUrl/v1/auth/refresh",
      "POST",
      body = JSONObject().put("refreshToken", refreshToken).toString(),
    )
    if (response.status !in 200..299) {
      if (response.status == 401 || response.status == 403) {
        throw RefreshSessionRejectedException("Your WidgetComposer session expired. Open the app to sign in again.")
      }
      throw IOException("API session refresh returned HTTP ${response.status}.")
    }
    val body = JSONObject(response.body)
    val accessToken = body.optString("accessToken").takeIf(String::isNotBlank)
      ?: throw IOException("API session refresh returned no access token.")
    val nextRefreshToken = body.optString("refreshToken").takeIf(String::isNotBlank)
      ?: throw IOException("API session refresh returned no refresh token.")
    return accessToken to nextRefreshToken
  }

  private fun httpRequest(url: String, method: String, authorization: String? = null, body: String? = null): HttpResponse {
    val connection = URL(url).openConnection() as HttpURLConnection
    try {
      connection.requestMethod = method
      connection.connectTimeout = REQUEST_TIMEOUT_MS
      connection.readTimeout = REQUEST_TIMEOUT_MS
      connection.instanceFollowRedirects = false
      connection.setRequestProperty("Accept", "application/json")
      authorization?.let { connection.setRequestProperty("Authorization", it) }
      if (body != null) {
        connection.doOutput = true
        connection.setRequestProperty("Content-Type", "application/json")
        connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
      }
      val status = connection.responseCode
      val stream = if (status in 200..399) connection.inputStream else connection.errorStream
      val responseBody = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
      return HttpResponse(status, responseBody)
    } finally {
      connection.disconnect()
    }
  }

  private fun widgetDataUrl(apiBaseUrl: String, widgetId: String): String =
    "$apiBaseUrl/v1/widgets/${Uri.encode(widgetId)}/data?refresh=true"

  private fun fail(widgetId: String, message: String): Result {
    Log.e(ComposerWidgetProvider.TAG, "Widget $widgetId refresh failed: $message")
    return Result.failure(workDataOf(KEY_ERROR to message))
  }

  private data class HttpResponse(val status: Int, val body: String)

  private class RefreshSessionRejectedException(message: String) : Exception(message)

  companion object {
    private const val KEY_WIDGET_ID = "widgetId"
    private const val KEY_ERROR = "error"
    private const val REQUEST_TIMEOUT_MS = 20_000

    fun enqueue(context: Context, widgetId: String) {
      val request = OneTimeWorkRequestBuilder<WidgetRefreshWorker>()
        .setInputData(workDataOf(KEY_WIDGET_ID to widgetId))
        .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
        .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
        .build()
      WorkManager.getInstance(context.applicationContext)
        .enqueueUniqueWork("widget-refresh:$widgetId", ExistingWorkPolicy.KEEP, request)
    }
  }
}
