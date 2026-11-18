// Generated from the backend WidgetSpec registries. Do not edit by hand.
package expo.modules.widgetruntime

internal object WidgetContract {
  const val CURRENT_SCHEMA_VERSION = 10
  const val SCHEMA_SHA256 = "2509267e0d52936cb2b08494625ac08742b0846a64cbe1e7f4c031cc38e3c890"
  val SUPPORTED_SCHEMA_VERSIONS = setOf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)
  val COMPONENT_TYPES = setOf("column", "row", "text", "image", "link", "clock", "metric", "progress", "device_info", "list", "streak_chart", "divider", "spacer", "button", "toggle", "slider", "chip")
  val ACTION_TYPES = setOf("open_url", "open_app", "refresh", "lock_screen")
  val PROVIDER_IDS = setOf("github", "website", "news", "android_device_info", "clock")
  val RENDERER_IDS = setOf("android-glance-v1", "android-remoteviews-v1")
}
