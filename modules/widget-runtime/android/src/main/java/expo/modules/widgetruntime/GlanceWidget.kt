package expo.modules.widgetruntime

import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import android.util.Log
import android.widget.RemoteViews
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.LocalSize
import androidx.glance.GlanceModifier
import androidx.glance.ColorFilter
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.action.clickable
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.AndroidRemoteViews
import androidx.glance.appwidget.ExperimentalGlanceRemoteViewsApi
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.ContentScale
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.FontFamily
import androidx.glance.text.Text
import androidx.glance.text.TextDecoration
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import androidx.glance.appwidget.cornerRadius
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.pow

/** Declarative Android home-screen renderer for the same validated WidgetSpec. */
internal class ComposerGlanceWidget : GlanceAppWidget() {
  override val sizeMode = SizeMode.Exact

  override suspend fun provideGlance(context: Context, id: androidx.glance.GlanceId) {
    val appWidgetId = GlanceAppWidgetManager(context).getAppWidgetId(id)
    val store = WidgetStore(context)
    val widgetId = store.boundWidget(appWidgetId) ?: store.latestId()?.also { store.bind(appWidgetId, it) }
    val payload = widgetId?.let(store::get)
    val spec = payload?.optJSONObject("spec")
    val schemaVersion = spec?.optInt("schemaVersion") ?: 0
    val unsupportedSchemaVersion = schemaVersion !in WidgetContract.SUPPORTED_SCHEMA_VERSIONS
    val data = payload?.optJSONObject("data")
    val presentation = spec?.optJSONObject("presentation")
    val palette = WidgetPalette.from(
      context,
      presentation?.optString("theme") ?: "dark",
      presentation?.optString("fontFamily") ?: "sans",
      presentation?.optJSONObject("palette"),
    )
    val images = if (spec != null) decodeImages(spec.optJSONObject("root"), data) else emptyMap()
    val homeIntent = Intent(Intent.ACTION_VIEW, Uri.parse("web2widgets://home?widget=${Uri.encode(widgetId.orEmpty())}"))
      .setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    val refreshAction = actionRunCallback<RefreshWidgetAction>(
      actionParametersOf(REFRESH_WIDGET_ID_KEY to widgetId.orEmpty()),
    )
    provideContent {
      val widgetSize = LocalSize.current
      val compact = widgetSize.width < 180.dp || widgetSize.height < 110.dp
      val veryCompact = widgetSize.width < 140.dp || widgetSize.height < 90.dp
      val outerPadding = if (compact) 8.dp else 16.dp
      Box(
        modifier = GlanceModifier
          .fillMaxSize()
          .background(palette.background)
          .cornerRadius(24.dp)
          .clickable(actionStartActivity(homeIntent))
          .padding(outerPadding),
        contentAlignment = Alignment.TopStart,
      ) {
        if (spec == null) {
          Text("Create a widget in WidgetComposer first", style = textStyle(palette.muted, 13, FontWeight.Normal, palette.fontFamily))
        } else if (unsupportedSchemaVersion) {
          Text("Update WidgetComposer to view this widget", style = textStyle(palette.muted, 13, FontWeight.Normal, palette.fontFamily))
        } else {
          Column(modifier = GlanceModifier.fillMaxWidth()) {
            Row(verticalAlignment = Alignment.CenterVertically) {
              if (!veryCompact) {
                Box(
                  modifier = GlanceModifier.width(4.dp).height(16.dp).background(palette.accent).cornerRadius(2.dp),
                ) {}
                Spacer(GlanceModifier.width(8.dp))
                Text(spec.optString("name", "Widget"), style = textStyle(palette.text, 14, FontWeight.Medium, palette.fontFamily), maxLines = 1)
                Spacer(GlanceModifier.width(10.dp))
              }
              Image(
                provider = ImageProvider(R.drawable.wr_refresh),
                contentDescription = "Refresh widget data",
                colorFilter = ColorFilter.tint(androidx.glance.unit.ColorProvider(palette.accent)),
                modifier = GlanceModifier.size(if (compact) 32.dp else 36.dp)
                  .clickable(refreshAction)
                  .padding(if (compact) 7.dp else 9.dp),
              )
            }
            Spacer(GlanceModifier.height(if (compact) 4.dp else 8.dp))
            val root = spec.optJSONObject("root")
            if (root != null) {
              WidgetNodeView(root, data, images, palette, context, homeIntent, widgetId.orEmpty(), compact)
            }
            if (!compact && payload?.optBoolean("sample", false) == true) {
              Spacer(GlanceModifier.height(5.dp))
              Text("Sample data", style = textStyle(palette.muted, 9, FontWeight.Normal, palette.fontFamily), maxLines = 1)
            }
          }
        }
      }
    }
  }

  override fun onCompositionError(
    context: Context,
    glanceId: androidx.glance.GlanceId,
    appWidgetId: Int,
    throwable: Throwable,
  ) {
    Log.e(ComposerWidgetProvider.TAG, "Glance render failed for widget instance $appWidgetId", throwable)
    val store = WidgetStore(context)
    val widgetId = store.boundWidget(appWidgetId) ?: store.latestId()
    val payload = widgetId?.let(store::get)
    val fallback = if (widgetId != null && payload != null) {
      runCatching { WidgetRenderer(context, appWidgetId, widgetId, payload).render() }
        .getOrElse { RemoteViews(context.packageName, R.layout.widget_runtime_root) }
    } else {
      RemoteViews(context.packageName, R.layout.widget_runtime_root)
    }
    android.appwidget.AppWidgetManager.getInstance(context).updateAppWidget(appWidgetId, fallback)
  }

  private fun decodeImages(root: JSONObject?, data: JSONObject?): Map<String, Bitmap> {
    val bindings = linkedSetOf<String>()
    collectImageBindings(root, bindings)
    return bindings.mapNotNull { binding ->
      val asset = ASSET_BINDING.matches(binding)
      val encoded = if (asset) {
        data?.optJSONObject(binding)?.optJSONArray("items")?.optJSONObject(0)?.optString("imageData")
      } else {
        val match = IMAGE_BINDING.matchEntire(binding) ?: return@mapNotNull null
        val index = match.groupValues[2].toIntOrNull() ?: return@mapNotNull null
        data?.optJSONObject(match.groupValues[1])?.optJSONArray("items")?.optJSONObject(index)?.optString("imageData")
      }?.takeIf(String::isNotBlank) ?: return@mapNotNull null
      decodeImage(encoded)?.let { bitmap -> binding to bitmap }
    }.toMap()
  }

  private fun collectImageBindings(node: JSONObject?, found: MutableSet<String>) {
    if (node == null) return
    when (node.optString("type")) {
      "image" -> node.optString("source").takeIf { IMAGE_BINDING.matches(it) || ASSET_BINDING.matches(it) }?.let(found::add)
      "column", "row" -> node.optJSONArray("children")?.let { children ->
        for (index in 0 until children.length()) collectImageBindings(children.optJSONObject(index), found)
      }
    }
  }

  private fun decodeImage(encoded: String): Bitmap? {
    if (encoded.length > 700_000) return null
    return runCatching {
      val bytes = Base64.decode(encoded, Base64.DEFAULT)
      val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
      if (bounds.outWidth <= 0 || bounds.outHeight <= 0 || bounds.outWidth > 10_000 || bounds.outHeight > 10_000) {
        null
      } else {
        var sample = 1
        while (maxOf(bounds.outWidth, bounds.outHeight) / sample > 192) sample *= 2
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample })
      }
    }.getOrNull()
  }

  private companion object {
    val IMAGE_BINDING = Regex("""^([a-z][a-z0-9_]{0,23})\.items\[(\d{1,2})\]\.imageUrl$""")
    val ASSET_BINDING = Regex("""^asset_[0-9a-f-]{36}$""", RegexOption.IGNORE_CASE)
  }
}

private data class WidgetPalette(
  val background: Color,
  val surface: Color,
  val text: Color,
  val muted: Color,
  val accent: Color,
  val divider: Color,
  val fontFamily: FontFamily,
  val fontKey: String,
) {
  companion object {
    fun from(context: Context, theme: String, fontKey: String, custom: JSONObject?): WidgetPalette {
      val isNight = (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
      val dark = theme == "dark" || (theme == "system" && isNight)
      val font = when (fontKey) {
        "serif" -> FontFamily.Serif
        "monospace" -> FontFamily.Monospace
        else -> FontFamily.SansSerif
      }
      fun parse(value: String) = Color(android.graphics.Color.parseColor(value))
      val fallback = if (dark) {
        listOf("#141218", "#211F26", "#E6E1E5", "#CAC4D0", "#D0BCFF", "#938F99")
      } else {
        listOf("#FEF7FF", "#F7F2FA", "#1D1B20", "#49454F", "#6750A4", "#79747E")
      }
      val values = listOf("background", "surface", "text", "muted", "accent", "border").mapIndexed { index, key ->
        custom?.optString(key)?.takeIf { it.matches(Regex("^#[0-9a-fA-F]{6}$")) } ?: fallback[index]
      }.map(::parse)
      return WidgetPalette(values[0], values[1], values[2], values[3], values[4], values[5], font, fontKey)
    }
  }
}

internal val REFRESH_WIDGET_ID_KEY = ActionParameters.Key<String>("widgetId")

class RefreshWidgetAction : ActionCallback {
  override suspend fun onAction(
    context: Context,
    glanceId: androidx.glance.GlanceId,
    parameters: ActionParameters,
  ) {
    val widgetId = parameters[REFRESH_WIDGET_ID_KEY]
    if (widgetId.isNullOrBlank()) {
      Log.e(ComposerWidgetProvider.TAG, "Ignoring Glance refresh action without a widget id.")
      return
    }
    WidgetRefreshWorker.enqueue(context, widgetId)
  }
}

@OptIn(ExperimentalGlanceRemoteViewsApi::class)
@Composable
private fun WidgetNodeView(
  node: JSONObject,
  data: JSONObject?,
  images: Map<String, Bitmap>,
  palette: WidgetPalette,
  context: Context,
  homeIntent: Intent,
  widgetId: String,
  compact: Boolean,
) {
  when (node.optString("type")) {
    "column" -> {
      val children = node.optJSONArray("children") ?: JSONArray()
      var modifier = GlanceModifier.fillMaxWidth()
      if (node.optBoolean("surface", false)) {
        modifier = modifier.background(palette.surface).cornerRadius(node.optInt("radiusDp", 16).coerceIn(0, 24).dp)
          .padding(if (compact) node.optInt("paddingDp", 8).coerceIn(0, 12).dp else node.optInt("paddingDp", 12).coerceIn(0, 24).dp)
      }
      Column(modifier = modifier) {
        for (index in 0 until minOf(children.length(), 10)) {
          if (index > 0) Spacer(GlanceModifier.height(if (compact) node.optInt("gap", 0).coerceIn(0, 8).dp else node.optInt("gap", 0).coerceIn(0, 64).dp))
          children.optJSONObject(index)?.let { WidgetNodeView(it, data, images, palette, context, homeIntent, widgetId, compact) }
        }
      }
    }
    "row" -> {
      val children = node.optJSONArray("children") ?: JSONArray()
      var modifier = GlanceModifier.fillMaxWidth()
      if (node.optBoolean("surface", false)) {
        modifier = modifier.background(palette.surface).cornerRadius(node.optInt("radiusDp", 16).coerceIn(0, 24).dp)
          .padding(if (compact) node.optInt("paddingDp", 8).coerceIn(0, 12).dp else node.optInt("paddingDp", 12).coerceIn(0, 24).dp)
      }
      Row(modifier = modifier, verticalAlignment = Alignment.CenterVertically) {
        for (index in 0 until minOf(children.length(), 10)) {
          if (index > 0) Spacer(GlanceModifier.width(if (compact) node.optInt("gap", 0).coerceIn(0, 8).dp else node.optInt("gap", 0).coerceIn(0, 64).dp))
          children.optJSONObject(index)?.let { WidgetNodeView(it, data, images, palette, context, homeIntent, widgetId, compact) }
        }
      }
    }
    "text" -> {
      val style = node.optString("style", "body")
      val color = when (node.optString("colorToken")) { "muted" -> palette.muted; "accent" -> palette.accent; else -> if (style == "caption") palette.muted else palette.text }
      val weight = when (node.optString("weight")) { "bold" -> FontWeight.Bold; "medium" -> FontWeight.Medium; "normal" -> FontWeight.Normal; else -> if (style == "title") FontWeight.Bold else FontWeight.Normal }
      val requestedSize = node.optInt("fontSizeDp", if (style == "title") 17 else if (style == "caption") 10 else 14).coerceIn(10, 32)
      Text(template(node.optString("text"), data), style = textStyle(color, if (compact) minOf(requestedSize, 14) else requestedSize, weight, palette.fontFamily), maxLines = if (compact) 2 else 3)
    }
    "image" -> {
      val source = node.optString("source")
      val bitmap = images[source]
      if (bitmap != null) {
        val fit = if (node.optString("fit") == "contain") ContentScale.Fit else ContentScale.Crop
        val maxImageSize = if (compact) 40 else 240
        Image(
          ImageProvider(bitmap), node.optString("alt", "Widget image"),
          GlanceModifier.size(node.optInt("widthDp", 48).coerceIn(24, maxImageSize).dp, node.optInt("heightDp", 48).coerceIn(24, maxImageSize).dp)
            .cornerRadius(node.optInt("radiusDp", 12).coerceIn(0, 24).dp),
          fit,
        )
      } else {
        Text(node.optString("alt", "Image unavailable"), style = textStyle(palette.muted, 10, FontWeight.Normal, palette.fontFamily), maxLines = 1)
      }
    }
    "link" -> {
      val label = node.optString("label")
      val url = safeUrl(resolve(data, node.optString("urlBinding")))
      val modifier = if (url != null) GlanceModifier.clickable(actionStartActivity(openUrlIntent(url))) else GlanceModifier
      Text(label, modifier, style = TextStyle(color = ColorProvider(palette.accent), fontSize = 12.sp, fontWeight = FontWeight.Medium, fontFamily = palette.fontFamily, textDecoration = TextDecoration.Underline), maxLines = 1)
    }
    "clock" -> {
      val clockLayout = when (palette.fontKey) {
        "serif" -> R.layout.wr_clock_serif
        "monospace" -> R.layout.wr_clock_monospace
        else -> R.layout.wr_clock
      }
      val remoteViews = RemoteViews(context.packageName, clockLayout).apply {
        val format = node.optString("format", "12_hour")
        val seconds = node.optBoolean("showSeconds", false)
        val timeFormat = if (format == "24_hour") if (seconds) "HH:mm:ss" else "HH:mm" else if (seconds) "h:mm:ss a" else "h:mm a"
        setCharSequence(R.id.wr_clock_time, "setFormat12Hour", timeFormat)
        setCharSequence(R.id.wr_clock_time, "setFormat24Hour", timeFormat)
        setTextColor(R.id.wr_clock_time, palette.accent.toArgb())
        setViewVisibility(R.id.wr_clock_date, if (node.optBoolean("showDate", false)) android.view.View.VISIBLE else android.view.View.GONE)
        setCharSequence(R.id.wr_clock_date, "setFormat12Hour", "EEE, MMM d")
        setCharSequence(R.id.wr_clock_date, "setFormat24Hour", "EEE, MMM d")
        setTextColor(R.id.wr_clock_date, palette.muted.toArgb())
      }
      AndroidRemoteViews(remoteViews)
    }
    "metric" -> {
      Column {
        Text(resolve(data, node.optString("valueBinding")) ?: "–", style = textStyle(palette.accent, 26, FontWeight.Bold, palette.fontFamily), maxLines = 1)
        Text(node.optString("label"), style = textStyle(palette.muted, 10, FontWeight.Normal, palette.fontFamily), maxLines = 1)
      }
    }
    "progress" -> {
      val value = (resolve(data, node.optString("valueBinding"))?.toDoubleOrNull() ?: 0.0).coerceAtLeast(0.0)
      val max = node.optInt("maxValue", 100).coerceAtLeast(1)
      val width = node.optInt("widthDp", 128).coerceIn(50, 240)
      val height = node.optInt("heightDp", 7).coerceIn(3, 16)
      Column {
        if (node.optString("label").isNotBlank()) Text(node.optString("label"), style = textStyle(palette.muted, 10, FontWeight.Normal, palette.fontFamily), maxLines = 1)
        Box(modifier = GlanceModifier.width(width.dp).height(height.dp).background(palette.divider).cornerRadius((height / 2).coerceAtLeast(1).dp)) {
          val fill = (width * (value / max).coerceIn(0.0, 1.0)).toInt().coerceAtLeast(if (value > 0) 1 else 0)
          if (fill > 0) Box(modifier = GlanceModifier.width(fill.dp).height(height.dp).background(palette.accent).cornerRadius((height / 2).coerceAtLeast(1).dp)) {}
        }
      }
    }
    "device_info" -> {
      val metric = readDeviceMetric(context, node.optString("metric"))
      val label = node.optString("label").takeIf { it.isNotBlank() } ?: metric.label
      val display = node.optString("display").ifBlank {
        if (node.optString("metric") == "battery_level" || node.optString("metric") == "storage_used_percent") "progress" else "text"
      }
      when (display) {
        "progress" -> {
          val progress = metric.progress ?: 0
          val width = node.optInt("widthDp", 128).coerceIn(50, 240)
          val height = node.optInt("heightDp", 7).coerceIn(3, 16)
          Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
              Text(label, style = textStyle(palette.muted, 10, FontWeight.Normal, palette.fontFamily), maxLines = 1)
              Text(metric.value, style = textStyle(palette.text, 10, FontWeight.Medium, palette.fontFamily), maxLines = 1)
            }
            Box(modifier = GlanceModifier.width(width.dp).height(height.dp).background(palette.divider).cornerRadius((height / 2).coerceAtLeast(1).dp)) {
              val fill = (width * progress / 100.0).toInt().coerceAtLeast(if (progress > 0) 1 else 0)
              if (fill > 0) Box(modifier = GlanceModifier.width(fill.dp).height(height.dp).background(palette.accent).cornerRadius((height / 2).coerceAtLeast(1).dp)) {}
            }
          }
        }
        "metric" -> Column {
          Text(metric.value, style = textStyle(palette.accent, 24, FontWeight.Bold, palette.fontFamily), maxLines = 1)
          Text(label, style = textStyle(palette.muted, 10, FontWeight.Normal, palette.fontFamily), maxLines = 1)
        }
        else -> Row(verticalAlignment = Alignment.CenterVertically) {
          Text(label, style = textStyle(palette.muted, 11, FontWeight.Normal, palette.fontFamily), maxLines = 1)
          Text(metric.value, style = textStyle(palette.text, 12, FontWeight.Medium, palette.fontFamily), maxLines = 1)
        }
      }
    }
    "list" -> {
      val items = data?.optJSONObject(node.optString("source"))?.optJSONArray("items") ?: JSONArray()
      val requestedCount = node.optInt("maxItems", 3).coerceIn(1, 5)
      val count = minOf(items.length(), if (compact) 1 else requestedCount, 5)
      if (count == 0) {
        Text(if (data == null) "Loading…" else "Nothing here", style = textStyle(palette.muted, 10, FontWeight.Normal, palette.fontFamily), maxLines = 1)
      } else {
        Column(modifier = GlanceModifier.fillMaxWidth()) {
          for (index in 0 until count) {
            val item = items.optJSONObject(index) ?: continue
            val title = item.optString("title", "Untitled")
            val url = safeUrl(item.optString("url"))
            val modifier = if (url != null) GlanceModifier.clickable(actionStartActivity(openUrlIntent(url))).fillMaxWidth() else GlanceModifier.fillMaxWidth()
            Column(modifier = modifier.padding(vertical = 3.dp)) {
              Text(title, style = textStyle(palette.text, 13, FontWeight.Bold, palette.fontFamily), maxLines = 1)
              val repo = item.optString("repo")
              val number = item.optInt("number", 0)
              val meta = if (number > 0) "$repo#$number" else repo.ifBlank { item.optString("author") }
              if (meta.isNotBlank()) Text(meta, style = textStyle(palette.muted, 10, FontWeight.Normal, palette.fontFamily), maxLines = 1)
            }
          }
        }
      }
    }
    "streak_chart" -> StreakChart(node, data, palette)
    "divider" -> Box(GlanceModifier.fillMaxWidth().height(1.dp).background(palette.divider)) {}
    "spacer" -> Spacer(GlanceModifier.height(node.optInt("sizeDp", 8).coerceIn(1, 64).dp))
    "button" -> {
      val label = template(node.optString("label"), data)
      val action = node.optJSONObject("action")
      val actionType = action?.optString("type")
      val url = if (actionType == "open_url") safeUrl(resolve(data, action?.optString("urlBinding") ?: "")) else null
      var modifier = GlanceModifier
        .background(palette.accent)
        .cornerRadius(20.dp)
      modifier = when (actionType) {
        "lock_screen" -> modifier.clickable(actionRunCallback<LockScreenAction>())
        "refresh" -> modifier.clickable(
          actionRunCallback<RefreshWidgetAction>(
            actionParametersOf(REFRESH_WIDGET_ID_KEY to widgetId),
          ),
        )
        "open_url" -> modifier.clickable(actionStartActivity(url?.let(::openUrlIntent) ?: homeIntent))
        else -> modifier.clickable(actionStartActivity(homeIntent))
      }
      Box(
        modifier = modifier
          .height(if (compact) 40.dp else 48.dp)
          .padding(horizontal = 16.dp),
        contentAlignment = Alignment.Center,
      ) {
        Text(label, style = textStyle(Color(materialOnColor(palette.accent.toArgb())), 14, FontWeight.Medium, palette.fontFamily), maxLines = 1)
      }
    }
  }
}

internal class LockScreenAction : ActionCallback {
  override suspend fun onAction(context: Context, glanceId: androidx.glance.GlanceId, parameters: ActionParameters) {
    val manager = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as android.app.admin.DevicePolicyManager
    val admin = android.content.ComponentName(context, LockScreenAdminReceiver::class.java)
    if (manager.isAdminActive(admin)) {
      manager.lockNow()
      return
    }

    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("web2widgets://home?lockSetup=true&ts=${System.currentTimeMillis()}"))
      .setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(intent)
  }
}

@Composable
private fun StreakChart(node: JSONObject, data: JSONObject?, palette: WidgetPalette) {
  val summary = data?.optJSONObject(node.optString("source"))?.optJSONObject("contributions")
  val days = summary?.optJSONArray("days") ?: JSONArray()
  val current = summary?.optInt("currentStreak", 0)
  val best = summary?.optInt("longestStreak", 0)
  val total = summary?.optInt("total", 0)
  val levels = listOf(
    palette.divider,
    Color(android.graphics.Color.parseColor("#0E4429")),
    Color(android.graphics.Color.parseColor("#006D32")),
    Color(android.graphics.Color.parseColor("#26A641")),
    Color(android.graphics.Color.parseColor("#39D353")),
  )
  Column(modifier = GlanceModifier.fillMaxWidth()) {
    Text(
      if (current == null) "–" else "$current day${if (current == 1) "" else "s"}",
      style = textStyle(palette.accent, 22, FontWeight.Bold, palette.fontFamily),
      maxLines = 1,
    )
    Text(
      if (best == null) "Current streak · best –" else "Current streak · best $best",
      style = textStyle(palette.muted, 10, FontWeight.Normal, palette.fontFamily),
      maxLines = 1,
    )
    Spacer(GlanceModifier.height(7.dp))
    for (row in 0 until 4) {
      Row {
        for (column in 0 until 7) {
          val index = row * 7 + column
          val level = days.optJSONObject(index)?.optInt("level", 0)?.coerceIn(0, 4) ?: 0
          Box(
            modifier = GlanceModifier
              .padding(end = 3.dp, bottom = 3.dp)
              .size(9.dp)
              .background(levels[level])
              .cornerRadius(2.dp),
          ) {}
        }
      }
    }
    Text(
      if (total == null) "Contribution data will appear here" else "Past year · $total contributions",
      style = textStyle(palette.muted, 10, FontWeight.Normal, palette.fontFamily),
      maxLines = 1,
    )
  }
}

private fun textStyle(color: Color, size: Int, weight: FontWeight, fontFamily: FontFamily = FontFamily.SansSerif) =
  TextStyle(color = ColorProvider(color), fontSize = size.sp, fontWeight = weight, fontFamily = fontFamily)

internal fun materialOnColor(color: Int): Int {
  fun linear(channel: Int): Double {
    val normalized = channel / 255.0
    return if (normalized <= 0.04045) normalized / 12.92 else ((normalized + 0.055) / 1.055).pow(2.4)
  }
  val luminance = 0.2126 * linear(android.graphics.Color.red(color)) +
    0.7152 * linear(android.graphics.Color.green(color)) +
    0.0722 * linear(android.graphics.Color.blue(color))
  return if (luminance > 0.179) android.graphics.Color.rgb(29, 27, 32) else android.graphics.Color.WHITE
}

private fun template(value: String, data: JSONObject?): String = PLACEHOLDER.replace(value) { match ->
  resolve(data, match.groupValues[1].trim()) ?: "–"
}

private fun resolve(data: JSONObject?, binding: String): String? {
  val match = BINDING.matchEntire(binding) ?: return null
  val source = data?.optJSONObject(match.groupValues[1]) ?: return null
  if (match.groupValues[2].isEmpty()) return if (source.has("count")) source.optInt("count").toString() else null
  val item = source.optJSONArray("items")?.optJSONObject(match.groupValues[2].toInt()) ?: return null
  return item.opt(match.groupValues[3])?.toString()
}

private fun safeUrl(url: String?): String? = url?.takeIf {
  it.startsWith("https://") && Uri.parse(it).host?.isNotBlank() == true
}

private fun openUrlIntent(url: String) = Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

private val PLACEHOLDER = Regex("""\{\{\s*([^{}]*?)\s*\}\}""")
private val BINDING = Regex("""^([a-z][a-z0-9_]{0,23})\.(?:count|items\[(\d{1,2})\]\.(title|url|repo|number|author|updatedAt|imageUrl|summary|publishedAt|sourceName))$""")
