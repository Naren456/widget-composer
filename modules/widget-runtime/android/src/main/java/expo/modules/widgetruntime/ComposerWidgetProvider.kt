package expo.modules.widgetruntime

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.updateAll
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/** Glance receiver for each launcher instance of the user's generated widget. */
class ComposerWidgetProvider : GlanceAppWidgetReceiver() {
  override val glanceAppWidget: GlanceAppWidget = widget

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == ACTION_PINNED) {
      val appWidgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
      val widgetId = intent.getStringExtra(EXTRA_WIDGET_ID)
      if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID && widgetId != null) {
        Log.d(TAG, "instance $appWidgetId pinned with widget $widgetId")
        WidgetStore(context).bind(appWidgetId, widgetId)
        GlanceWidgetUpdates.update(context, appWidgetId)
      }
      return
    }
    if (intent.action == ACTION_REFRESH) {
      val widgetId = intent.getStringExtra(EXTRA_WIDGET_ID)
      if (widgetId.isNullOrBlank()) {
        Log.e(TAG, "Ignoring refresh request without a widget id.")
      } else {
        WidgetRefreshWorker.enqueue(context, widgetId)
      }
      return
    }
    super.onReceive(context, intent)
  }

  override fun onDeleted(context: Context, appWidgetIds: IntArray) {
    val store = WidgetStore(context)
    appWidgetIds.forEach {
      Log.d(TAG, "instance $it removed")
      store.recordRemoval(it)
      store.unbind(it)
    }
    super.onDeleted(context, appWidgetIds)
  }

  companion object {
    internal const val TAG = "WidgetRuntime"
    internal const val ACTION_PINNED = "expo.modules.widgetruntime.PINNED"
    internal const val ACTION_REFRESH = "expo.modules.widgetruntime.REFRESH"
    internal const val EXTRA_WIDGET_ID = "widgetId"
    internal val widget = ComposerGlanceWidget()

    fun component(context: Context) = ComponentName(context, ComposerWidgetProvider::class.java)

    fun placedIds(context: Context): IntArray = AppWidgetManager.getInstance(context).getAppWidgetIds(component(context))

    fun updateAll(context: Context) = GlanceWidgetUpdates.updateAll(context)
  }
}

internal object GlanceWidgetUpdates {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

  fun updateAll(context: Context) {
    scope.launch {
      runCatching { ComposerWidgetProvider.widget.updateAll(context.applicationContext) }
        .onFailure { Log.e(ComposerWidgetProvider.TAG, "Glance widget update failed", it) }
    }
  }

  fun update(context: Context, appWidgetId: Int) {
    scope.launch {
      runCatching {
        val glanceId = androidx.glance.appwidget.GlanceAppWidgetManager(context).getGlanceIdBy(appWidgetId)
        ComposerWidgetProvider.widget.update(context.applicationContext, glanceId)
      }.onFailure { Log.e(ComposerWidgetProvider.TAG, "Glance widget $appWidgetId update failed", it) }
    }
  }
}
