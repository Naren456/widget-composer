package expo.modules.widgetruntime

import android.Manifest
import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.PowerManager
import android.os.StatFs
import java.util.Locale

internal data class DeviceMetricValue(val label: String, val value: String, val progress: Int? = null)

/** Reads a deliberately small, read-only set of device facts for home-screen widgets. */
internal fun readDeviceMetric(context: Context, metric: String): DeviceMetricValue {
  val battery = runCatching { context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED)) }.getOrNull()
  val batteryLevel = battery?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
  val batteryScale = battery?.getIntExtra(BatteryManager.EXTRA_SCALE, 100) ?: 100
  val percent = if (batteryLevel >= 0 && batteryScale > 0) (batteryLevel * 100 / batteryScale).coerceIn(0, 100) else null

  return when (metric) {
    "battery_level" -> DeviceMetricValue("Battery", percent?.let { "$it%" } ?: "Unavailable", percent)
    "battery_status" -> {
      val status = battery?.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
      val plugged = battery?.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) ?: 0
      val text = when (status) {
        BatteryManager.BATTERY_STATUS_CHARGING -> "Charging"
        BatteryManager.BATTERY_STATUS_FULL -> "Full"
        else -> if (plugged != 0) "Plugged in" else "Not charging"
      }
      DeviceMetricValue("Battery", text)
    }
    "battery_health" -> {
      val health = battery?.getIntExtra(BatteryManager.EXTRA_HEALTH, -1)
      val text = when (health) {
        BatteryManager.BATTERY_HEALTH_GOOD -> "Good"
        BatteryManager.BATTERY_HEALTH_OVERHEAT -> "Overheated"
        BatteryManager.BATTERY_HEALTH_DEAD -> "Failure"
        BatteryManager.BATTERY_HEALTH_COLD -> "Cold"
        BatteryManager.BATTERY_HEALTH_OVER_VOLTAGE -> "Over voltage"
        else -> "Unknown"
      }
      DeviceMetricValue("Battery health", text)
    }
    "bluetooth_status" -> {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && context.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
        DeviceMetricValue("Bluetooth", "Allow Nearby devices")
      } else {
        val adapter = runCatching { context.getSystemService(BluetoothManager::class.java)?.adapter }.getOrNull()
        DeviceMetricValue("Bluetooth", when { adapter == null -> "Unavailable"; adapter.isEnabled -> "On"; else -> "Off" })
      }
    }
    "wifi_status" -> {
      val enabled = runCatching { context.applicationContext.getSystemService(WifiManager::class.java)?.isWifiEnabled }.getOrNull()
      DeviceMetricValue("Wi-Fi", when (enabled) { true -> "On"; false -> "Off"; else -> "Unavailable" })
    }
    "network_type" -> {
      val manager = context.getSystemService(ConnectivityManager::class.java)
      val network = runCatching { manager?.activeNetwork }.getOrNull()
      val capabilities = runCatching { if (network != null) manager?.getNetworkCapabilities(network) else null }.getOrNull()
      val online = capabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true &&
        capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
      val type = when {
        !online -> "Offline"
        capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true -> "Wi-Fi"
        capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) == true -> "Mobile data"
        capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) == true -> "Ethernet"
        capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_VPN) == true -> "VPN"
        else -> "Connected"
      }
      DeviceMetricValue("Internet", type)
    }
    "storage_free", "storage_used_percent" -> {
      val stats = runCatching { StatFs(Environment.getDataDirectory().absolutePath) }.getOrNull()
      val total = stats?.totalBytes?.coerceAtLeast(1) ?: 1
      val available = stats?.availableBytes?.coerceAtLeast(0) ?: 0
      val used = ((total - available) * 100 / total).toInt().coerceIn(0, 100)
      if (metric == "storage_free") {
        DeviceMetricValue("Free storage", String.format(Locale.US, "%.1f GB", available / 1_073_741_824.0))
      } else {
        DeviceMetricValue("Storage used", "$used%", used)
      }
    }
    "power_saver" -> {
      val enabled = runCatching { context.getSystemService(PowerManager::class.java)?.isPowerSaveMode }.getOrNull()
      DeviceMetricValue("Power saver", if (enabled == true) "On" else if (enabled == false) "Off" else "Unavailable")
    }
    "device_model" -> DeviceMetricValue("Device", listOf(Build.MANUFACTURER, Build.MODEL).filter(String::isNotBlank).distinct().joinToString(" "))
    "android_version" -> DeviceMetricValue("Android", Build.VERSION.RELEASE ?: "Unknown")
    else -> DeviceMetricValue("Device info", "Unavailable")
  }
}
