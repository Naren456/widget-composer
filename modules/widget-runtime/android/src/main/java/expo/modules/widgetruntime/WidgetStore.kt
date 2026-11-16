package expo.modules.widgetruntime

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID

/**
 * Widgets the app saved for the home screen, and which placed instance shows which widget.
 *
 * A payload is `{ id, spec, data, sample, updatedAt }`: the WidgetSpec from the API
 * and the data last fetched for it. WorkManager uses app-private credentials to refresh
 * this cached data without opening the app; the widget renderer itself remains local.
 */
internal class WidgetStore(context: Context) {
  private val prefs = context.applicationContext.getSharedPreferences("widget_runtime", Context.MODE_PRIVATE)

  data class BackgroundRefreshCredentials(
    val apiBaseUrl: String,
    val userId: String,
    val accessToken: String,
    val refreshToken: String,
  )

  fun put(widgetId: String, payload: String) {
    prefs.edit().putString(WIDGET + widgetId, payload).putString(LATEST, widgetId).apply()
  }

  fun saveBackgroundRefreshCredentials(apiBaseUrl: String, userId: String, accessToken: String, refreshToken: String) {
    check(
      prefs.edit()
        .putString(API_BASE_URL, apiBaseUrl.trimEnd('/'))
        .putString(USER_ID, userId)
        .putString(ACCESS_TOKEN, accessToken)
        .putString(REFRESH_TOKEN, refreshToken)
        .commit(),
    ) { "Could not persist background refresh credentials." }
  }

  fun backgroundRefreshCredentials(): BackgroundRefreshCredentials? {
    val apiBaseUrl = prefs.getString(API_BASE_URL, null)?.takeIf(String::isNotBlank) ?: return null
    val userId = prefs.getString(USER_ID, null)?.takeIf(String::isNotBlank) ?: return null
    val accessToken = prefs.getString(ACCESS_TOKEN, null)?.takeIf(String::isNotBlank) ?: return null
    val refreshToken = prefs.getString(REFRESH_TOKEN, null)?.takeIf(String::isNotBlank) ?: return null
    return BackgroundRefreshCredentials(apiBaseUrl, userId, accessToken, refreshToken)
  }

  fun backgroundRefreshSession(): BackgroundRefreshCredentials? {
    val userId = prefs.getString(USER_ID, null)?.takeIf(String::isNotBlank) ?: return null
    val refreshToken = prefs.getString(REFRESH_TOKEN, null)?.takeIf(String::isNotBlank) ?: return null
    return BackgroundRefreshCredentials(
      prefs.getString(API_BASE_URL, "").orEmpty(),
      userId,
      prefs.getString(ACCESS_TOKEN, "").orEmpty(),
      refreshToken,
    )
  }

  fun updateBackgroundRefreshTokens(accessToken: String, refreshToken: String) {
    check(
      prefs.edit().putString(ACCESS_TOKEN, accessToken).putString(REFRESH_TOKEN, refreshToken).commit(),
    ) { "Could not persist refreshed API credentials." }
  }

  fun clearBackgroundRefreshCredentials() {
    check(
      prefs.edit()
        .remove(API_BASE_URL)
        .remove(USER_ID)
        .remove(ACCESS_TOKEN)
        .remove(REFRESH_TOKEN)
        .commit(),
    ) { "Could not clear background refresh credentials." }
  }

  fun updateWidgetData(widgetId: String, data: JSONObject) {
    val payload = get(widgetId) ?: error("No saved widget payload for $widgetId.")
    payload.put("data", data)
    payload.put("sample", false)
    val timestamp = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
      timeZone = TimeZone.getTimeZone("UTC")
    }.format(Date())
    payload.put("updatedAt", timestamp)
    check(prefs.edit().putString(WIDGET + widgetId, payload.toString()).commit()) {
      "Could not save refreshed widget data."
    }
  }

  fun get(widgetId: String): JSONObject? =
    prefs.getString(WIDGET + widgetId, null)?.let { runCatching { JSONObject(it) }.getOrNull() }

  /** The widget saved most recently; shown by an instance added from the launcher's widget list. */
  fun latestId(): String? = prefs.getString(LATEST, null)

  /** Stable random identity for this app installation; it is not a hardware identifier. */
  fun deviceId(): String {
    synchronized(prefs) {
      prefs.getString(DEVICE_ID, null)?.let { return it }
      val created = UUID.randomUUID().toString()
      check(prefs.edit().putString(DEVICE_ID, created).commit()) { "Could not persist widget installation identity." }
      return created
    }
  }

  fun bind(appWidgetId: Int, widgetId: String) {
    prefs.edit().putString(INSTANCE + appWidgetId, widgetId).apply()
  }

  fun boundWidget(appWidgetId: Int): String? = prefs.getString(INSTANCE + appWidgetId, null)

  fun unbind(appWidgetId: Int) {
    prefs.edit().remove(INSTANCE + appWidgetId).apply()
  }

  /** Keeps removal events until the app confirms that the API has reconciled them. */
  fun recordRemoval(appWidgetId: Int) {
    val widgetId = boundWidget(appWidgetId) ?: return
    val removals = runCatching { JSONArray(prefs.getString(REMOVALS, "[]")) }
      .getOrElse { JSONArray() }
    removals.put(
      JSONObject()
        .put("widgetId", widgetId)
        .put("deviceId", deviceId())
        .put("platformWidgetId", appWidgetId),
    )
    check(prefs.edit().putString(REMOVALS, removals.toString()).commit()) { "Could not persist widget removal event." }
  }

  fun pendingRemovals(): List<Map<String, Any>> {
    val removals = runCatching { JSONArray(prefs.getString(REMOVALS, "[]")) }
      .getOrElse { JSONArray() }
    return (0 until removals.length()).mapNotNull { index ->
      val item = removals.optJSONObject(index) ?: return@mapNotNull null
      val widgetId = item.optString("widgetId").takeIf(String::isNotBlank) ?: return@mapNotNull null
      val deviceId = item.optString("deviceId").takeIf(String::isNotBlank) ?: return@mapNotNull null
      val platformWidgetId = item.optInt("platformWidgetId", -1).takeIf { it >= 0 } ?: return@mapNotNull null
      mapOf("widgetId" to widgetId, "deviceId" to deviceId, "platformWidgetId" to platformWidgetId)
    }
  }

  fun acknowledgeRemoval(platformWidgetId: Int) {
    val removals = runCatching { JSONArray(prefs.getString(REMOVALS, "[]")) }
      .getOrElse { JSONArray() }
    val kept = JSONArray()
    for (index in 0 until removals.length()) {
      val item = removals.optJSONObject(index) ?: continue
      if (item.optInt("platformWidgetId", -1) != platformWidgetId) kept.put(item)
    }
    check(prefs.edit().putString(REMOVALS, kept.toString()).commit()) { "Could not acknowledge widget removal event." }
  }

  /** Widget ids that at least one placed instance shows. */
  fun placedWidgetIds(appWidgetIds: IntArray): List<String> =
    appWidgetIds.toList().mapNotNull(::widgetForInstance).distinct()

  fun placedInstances(appWidgetIds: IntArray): List<Map<String, Any>> =
    appWidgetIds.toList().mapNotNull { appWidgetId ->
      widgetForInstance(appWidgetId)?.let { widgetId ->
        mapOf(
          "widgetId" to widgetId,
          "deviceId" to deviceId(),
          "platformWidgetId" to appWidgetId,
          "renderer" to "android-remoteviews-v1",
        )
      }
    }

  private fun widgetForInstance(appWidgetId: Int): String? =
    boundWidget(appWidgetId) ?: latestId()?.also { bind(appWidgetId, it) }

  private companion object {
    const val API_BASE_URL = "background_api_base_url"
    const val USER_ID = "background_user_id"
    const val ACCESS_TOKEN = "background_access_token"
    const val REFRESH_TOKEN = "background_refresh_token"
    const val WIDGET = "widget:"
    const val INSTANCE = "instance:"
    const val LATEST = "latest"
    const val DEVICE_ID = "device_id"
    const val REMOVALS = "pending_removals"
  }
}
