package expo.modules.widgetruntime

import android.app.admin.DevicePolicyManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri

class LockScreenActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != ACTION_LOCK_SCREEN) return
    val manager = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
    val admin = ComponentName(context, LockScreenAdminReceiver::class.java)
    if (manager.isAdminActive(admin)) {
      manager.lockNow()
      return
    }

    val setupIntent = Intent(Intent.ACTION_VIEW, Uri.parse("web2widgets://home?lockSetup=true&ts=${System.currentTimeMillis()}"))
      .setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(setupIntent)
  }

  companion object {
    const val ACTION_LOCK_SCREEN = "expo.modules.widgetruntime.LOCK_SCREEN"
  }
}
