package expo.modules.widgetruntime

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

/** JS API for the home-screen widget: save widgets, ask to pin one, list placed ones. */
class WidgetRuntimeModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("WidgetRuntime")

    /** Whether the launcher supports adding a widget from inside the app (Android 8+). */
    Function("canPin") {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && AppWidgetManager.getInstance(context).isRequestPinAppWidgetSupported
    }

    /** Stores a widget's spec and data and redraws every instance. */
    Function("save") { widgetId: String, payloadJson: String ->
      val payload = JSONObject(payloadJson)
      require(payload.has("spec")) { "payload needs a spec" }
      WidgetStore(context).put(widgetId, payloadJson)
      Log.d(ComposerWidgetProvider.TAG, "saved widget $widgetId (${payloadJson.length} bytes)")
      ComposerWidgetProvider.updateAll(context)
    }

    Function("setBackgroundRefreshCredentials") { apiBaseUrl: String, userId: String, accessToken: String, refreshToken: String ->
      require(apiBaseUrl.startsWith("https://") || apiBaseUrl.startsWith("http://")) { "API URL must use HTTP or HTTPS." }
      require(userId.isNotBlank() && accessToken.isNotBlank() && refreshToken.isNotBlank()) { "Background refresh credentials are incomplete." }
      WidgetStore(context).saveBackgroundRefreshCredentials(apiBaseUrl, userId, accessToken, refreshToken)
    }

    Function("backgroundRefreshSession") {
      WidgetStore(context).backgroundRefreshSession()?.let { session ->
        mapOf("userId" to session.userId, "refreshToken" to session.refreshToken)
      }
    }

    Function("clearBackgroundRefreshCredentials") {
      WidgetStore(context).clearBackgroundRefreshCredentials()
    }

    /** Opens the launcher's "Add widget" prompt for `widgetId`. False when the launcher can't. */
    Function("requestPin") { widgetId: String ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return@Function false
      val manager = AppWidgetManager.getInstance(context)
      if (!manager.isRequestPinAppWidgetSupported) return@Function false
      // The launcher adds EXTRA_APPWIDGET_ID to this broadcast, so it must stay mutable.
      val callback = Intent(context, ComposerWidgetProvider::class.java)
        .setAction(ComposerWidgetProvider.ACTION_PINNED)
        .putExtra(ComposerWidgetProvider.EXTRA_WIDGET_ID, widgetId)
      val flags = PendingIntent.FLAG_UPDATE_CURRENT or
        (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0)
      val pending = PendingIntent.getBroadcast(context, widgetId.hashCode(), callback, flags)
      Log.d(ComposerWidgetProvider.TAG, "requesting pin for widget $widgetId")
      manager.requestPinAppWidget(ComposerWidgetProvider.component(context), null, pending)
    }

    /** Ids of saved widgets that are on the home screen now. */
    Function("placedWidgetIds") {
      WidgetStore(context).placedWidgetIds(ComposerWidgetProvider.placedIds(context))
    }

    /** Stable random installation ID used to reconcile placements with the API. */
    Function("deviceId") {
      WidgetStore(context).deviceId()
    }

    /** Current native app-widget IDs and their saved WidgetComposer widget IDs. */
    Function("placedInstances") {
      WidgetStore(context).placedInstances(ComposerWidgetProvider.placedIds(context))
    }

    /** Pending removals survive process death and offline periods until acknowledged. */
    Function("pendingRemovals") {
      WidgetStore(context).pendingRemovals()
    }

    Function("acknowledgeRemoval") { platformWidgetId: Int ->
      WidgetStore(context).acknowledgeRemoval(platformWidgetId)
    }

    /** Opens the Android-owned screen where the user may approve device-admin access. */
    Function("requestLockScreenAdmin") {
      val manager = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
      val admin = ComponentName(context, LockScreenAdminReceiver::class.java)
      if (manager.isAdminActive(admin)) return@Function true
      val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN)
        .putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, admin)
        .putExtra(
          DevicePolicyManager.EXTRA_ADD_EXPLANATION,
          "WidgetComposer uses this permission only when you tap the Lock screen widget action. It cannot erase device data.",
        )
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
      true
    }
  }
}
