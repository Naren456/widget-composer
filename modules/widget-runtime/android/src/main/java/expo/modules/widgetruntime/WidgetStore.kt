package expo.modules.widgetruntime

import android.content.Context
import org.json.JSONObject

/**
 * Widgets the app saved for the home screen, and which placed instance shows which widget.
 *
 * A payload is `{ id, spec, data, sample, updatedAt }`: the WidgetSpec from the API
 * and the data last fetched for it. The app writes payloads; the widget only reads them,
 * so a home-screen widget never needs credentials or the network.
 */
internal class WidgetStore(context: Context) {
  private val prefs = context.applicationContext.getSharedPreferences("widget_runtime", Context.MODE_PRIVATE)

  fun put(widgetId: String, payload: String) {
    prefs.edit().putString(WIDGET + widgetId, payload).putString(LATEST, widgetId).apply()
  }

  fun get(widgetId: String): JSONObject? =
    prefs.getString(WIDGET + widgetId, null)?.let { runCatching { JSONObject(it) }.getOrNull() }

  /** The widget saved most recently; shown by an instance added from the launcher's widget list. */
  fun latestId(): String? = prefs.getString(LATEST, null)

  fun bind(appWidgetId: Int, widgetId: String) {
    prefs.edit().putString(INSTANCE + appWidgetId, widgetId).apply()
  }

  fun boundWidget(appWidgetId: Int): String? = prefs.getString(INSTANCE + appWidgetId, null)

  fun unbind(appWidgetId: Int) {
    prefs.edit().remove(INSTANCE + appWidgetId).apply()
  }

  /** Widget ids that at least one placed instance shows. */
  fun placedWidgetIds(appWidgetIds: IntArray): List<String> =
    appWidgetIds.toList().mapNotNull { id -> boundWidget(id) }.distinct()

  private companion object {
    const val WIDGET = "widget:"
    const val INSTANCE = "instance:"
    const val LATEST = "latest"
  }
}
