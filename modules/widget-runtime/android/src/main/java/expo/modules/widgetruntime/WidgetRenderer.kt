package expo.modules.widgetruntime

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.content.res.Configuration
import android.os.Build
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.RectF
import android.net.Uri
import android.util.Base64
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONObject

/**
 * Legacy fallback renderer for WidgetSpec when Glance composition fails.
 *
 * Every node type maps to a fixed layout from this module, so a spec can only arrange
 * known views: it never carries code. External links must use HTTPS and come from
 * validated connector data, matching the server's rule for `open_url`.
 */
internal class WidgetRenderer(
  private val context: Context,
  private val appWidgetId: Int,
  private val widgetId: String,
  payload: JSONObject,
) {
  private val spec = payload.getJSONObject("spec")
  private val data: JSONObject? = payload.optJSONObject("data")
  private val sample = payload.optBoolean("sample", false)
  private val pkg = context.packageName
  private val presentation = spec.optJSONObject("presentation")
  private val palette = paletteFor(
    presentation?.optString("theme") ?: "dark",
    presentation?.optString("fontFamily") ?: "sans",
    presentation?.optJSONObject("palette"),
  )
  private var nextRequestCode = 0

  fun render(): RemoteViews {
    val root = RemoteViews(pkg, R.layout.widget_runtime_root)
    root.setInt(R.id.wr_root, "setBackgroundColor", palette.background)
    val backgroundAssetId = presentation?.optString("backgroundImageAssetId")?.takeIf { it.isNotBlank() && it != "null" }
    val backgroundItem = backgroundAssetId?.let { data?.optJSONObject("asset_$it")?.optJSONArray("items")?.optJSONObject(0) }
    val backgroundBitmap = backgroundItem?.optString("imageData")?.takeIf { it.isNotBlank() }?.let(::decodeImage)
    if (backgroundBitmap != null) {
      root.setViewVisibility(R.id.wr_background, View.VISIBLE)
      root.setImageViewBitmap(R.id.wr_background, backgroundBitmap)
    } else {
      root.setViewVisibility(R.id.wr_background, View.GONE)
    }
    root.setViewVisibility(R.id.wr_empty, View.GONE)
    root.removeAllViews(R.id.wr_content)
    if (spec.optInt("schemaVersion") < 1) {
      root.setViewVisibility(R.id.wr_empty, View.VISIBLE)
      root.setTextViewText(R.id.wr_empty, "Update WidgetComposer to view this widget.")
      root.setViewVisibility(R.id.wr_content, View.GONE)
      return root
    }
    root.addView(R.id.wr_content, RemoteViews(pkg, R.layout.wr_refresh).apply {
      setInt(R.id.wr_refresh, "setColorFilter", palette.accent)
      setOnClickPendingIntent(R.id.wr_refresh, refreshWidget())
    })
    root.addView(R.id.wr_content, node(spec.getJSONObject("root"), inRow = false))
    if (sample) {
      root.addView(R.id.wr_content, spacer(6, inRow = false))
      root.addView(R.id.wr_content, text("Sample data · connect GitHub in the app", "caption"))
    }
    root.setOnClickPendingIntent(R.id.wr_root, openApp())
    return root
  }

  private fun lockScreenAction(): PendingIntent {
    val intent = Intent(context, LockScreenActionReceiver::class.java)
      .setAction(LockScreenActionReceiver.ACTION_LOCK_SCREEN)
    return PendingIntent.getBroadcast(context, requestCode(), intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  }

  private fun node(node: JSONObject, inRow: Boolean): RemoteViews =
    when (node.optString("type")) {
      "column", "row" -> container(node)
      "text" -> text(template(node.optString("text")), if (node.optString("weight") == "bold") "title" else node.optString("style", "body"), node.optString("weight")).apply {
        val defaultSize = when (node.optString("style", "body")) { "title" -> 17; "caption" -> 10; else -> 14 }
        setTextViewTextSize(R.id.wr_text, TypedValue.COMPLEX_UNIT_SP, node.optInt("fontSizeDp", defaultSize).coerceIn(10, 32).toFloat())
        setTextColor(R.id.wr_text, when (node.optString("colorToken")) { "accent" -> palette.accent; "muted" -> palette.muted; else -> palette.text })
      }
      "image" -> image(node)
      "link" -> link(node)
      "clock" -> clock(node)
      "metric" -> metric(node)
      "progress" -> progress(node)
      "device_info" -> deviceInfo(node)
      "list" -> list(node)
      "streak_chart" -> streakChart(node)
      "divider" -> RemoteViews(pkg, R.layout.wr_divider).apply { setInt(R.id.wr_divider, "setBackgroundColor", palette.divider) }
      "spacer" -> spacer(node.optInt("sizeDp", 8), inRow)
      "button" -> button(node)
      // Unknown types come from a newer schema: skip them rather than fail the whole widget.
      else -> RemoteViews(pkg, R.layout.wr_spacer_4)
    }

  private fun container(node: JSONObject): RemoteViews {
    val isRow = node.optString("type") == "row"
    val views = RemoteViews(pkg, if (isRow) R.layout.wr_row else R.layout.wr_column)
    val gap = node.optInt("gap", 0)
    if (node.optBoolean("surface", false)) {
      views.setInt(R.id.wr_container, "setBackgroundColor", palette.surface)
      val padding = (node.optInt("paddingDp", 8).coerceIn(0, 24) * context.resources.displayMetrics.density).toInt()
      views.setViewPadding(R.id.wr_container, padding, padding, padding, padding)
    }
    val children = node.optJSONArray("children") ?: JSONArray()
    for (i in 0 until children.length()) {
      if (i > 0 && gap > 0) views.addView(R.id.wr_container, spacer(gap, isRow))
      views.addView(R.id.wr_container, node(children.getJSONObject(i), isRow))
    }
    return views
  }

  private fun text(value: String, style: String, weight: String = "normal"): RemoteViews {
    val layout = when {
      weight == "medium" -> R.layout.wr_text_medium
      style == "title" -> R.layout.wr_text_title
      style == "caption" -> R.layout.wr_text_caption
      else -> R.layout.wr_text_body
    }
    return RemoteViews(pkg, layout).apply {
      setTextViewText(R.id.wr_text, value)
      setTextColor(R.id.wr_text, if (style == "caption") palette.muted else palette.text)
    }
  }

  private fun metric(node: JSONObject) = RemoteViews(pkg, R.layout.wr_metric).apply {
    setTextViewText(R.id.wr_metric_value, resolve(node.optString("valueBinding")) ?: MISSING)
    setTextColor(R.id.wr_metric_value, palette.accent)
    setTextViewText(R.id.wr_metric_label, node.optString("label"))
    setTextColor(R.id.wr_metric_label, palette.muted)
  }

  private fun progress(node: JSONObject): RemoteViews {
    val value = resolve(node.optString("valueBinding"))?.toDoubleOrNull()?.coerceAtLeast(0.0) ?: 0.0
    val max = node.optInt("maxValue", 100).coerceAtLeast(1)
    val width = node.optInt("widthDp", 128).coerceIn(50, 240)
    val height = node.optInt("heightDp", 7).coerceIn(3, 16)
    val label = node.optString("label")
    return RemoteViews(pkg, R.layout.wr_progress).apply {
      setTextViewText(R.id.wr_progress_label, label)
      setTextColor(R.id.wr_progress_label, palette.muted)
      setViewVisibility(R.id.wr_progress_label, if (label.isBlank()) View.GONE else View.VISIBLE)
      setInt(R.id.wr_progress_track, "setBackgroundColor", palette.divider)
      setInt(R.id.wr_progress_fill, "setBackgroundColor", palette.accent)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        setViewLayoutWidth(R.id.wr_progress_track, width.toFloat(), TypedValue.COMPLEX_UNIT_DIP)
        setViewLayoutHeight(R.id.wr_progress_track, height.toFloat(), TypedValue.COMPLEX_UNIT_DIP)
        setViewLayoutWidth(R.id.wr_progress_fill, (width * (value / max).coerceIn(0.0, 1.0)).toFloat(), TypedValue.COMPLEX_UNIT_DIP)
        setViewLayoutHeight(R.id.wr_progress_fill, height.toFloat(), TypedValue.COMPLEX_UNIT_DIP)
      }
    }
  }

  private fun deviceInfo(node: JSONObject): RemoteViews {
    val metric = readDeviceMetric(context, node.optString("metric"))
    val label = node.optString("label").ifBlank { metric.label }
    val display = node.optString("display").ifBlank {
      if (node.optString("metric") == "battery_level" || node.optString("metric") == "storage_used_percent") "progress" else "text"
    }
    return when (display) {
      "progress" -> {
        val views = RemoteViews(pkg, R.layout.wr_progress)
        val width = node.optInt("widthDp", 128).coerceIn(50, 240)
        val height = node.optInt("heightDp", 7).coerceIn(3, 16)
        val progress = metric.progress ?: 0
        views.setTextViewText(R.id.wr_progress_label, "$label · ${metric.value}")
        views.setTextColor(R.id.wr_progress_label, palette.text)
        views.setInt(R.id.wr_progress_track, "setBackgroundColor", palette.divider)
        views.setInt(R.id.wr_progress_fill, "setBackgroundColor", palette.accent)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          views.setViewLayoutWidth(R.id.wr_progress_track, width.toFloat(), TypedValue.COMPLEX_UNIT_DIP)
          views.setViewLayoutHeight(R.id.wr_progress_track, height.toFloat(), TypedValue.COMPLEX_UNIT_DIP)
          views.setViewLayoutWidth(R.id.wr_progress_fill, (width * (progress / 100.0)).toFloat(), TypedValue.COMPLEX_UNIT_DIP)
          views.setViewLayoutHeight(R.id.wr_progress_fill, height.toFloat(), TypedValue.COMPLEX_UNIT_DIP)
        }
        views
      }
      "metric" -> RemoteViews(pkg, R.layout.wr_metric).apply {
        setTextViewText(R.id.wr_metric_value, metric.value)
        setTextColor(R.id.wr_metric_value, palette.accent)
        setTextViewText(R.id.wr_metric_label, label)
        setTextColor(R.id.wr_metric_label, palette.muted)
      }
      else -> text("$label  ${metric.value}", "body").apply { setTextColor(R.id.wr_text, palette.text) }
    }
  }

  private fun image(node: JSONObject): RemoteViews {
    val source = node.optString("source")
    val item = if (ASSET_BINDING.matches(source)) {
      data?.optJSONObject(source)?.optJSONArray("items")?.optJSONObject(0)
    } else {
      val match = BINDING.matchEntire(source) ?: return text(node.optString("alt", "Image unavailable"), "caption")
      if (match.groupValues[2].isEmpty() || match.groupValues[3] != "imageUrl") return text(node.optString("alt", "Image unavailable"), "caption")
      data?.optJSONObject(match.groupValues[1])?.optJSONArray("items")?.optJSONObject(match.groupValues[2].toInt())
    }
    item ?: return text(node.optString("alt", "Image unavailable"), "caption")
    val encoded = item.optString("imageData").takeIf { it.isNotBlank() }
      ?: return text(node.optString("alt", "Image unavailable"), "caption")
    val bitmap = decodeImage(encoded) ?: return text(node.optString("alt", "Image unavailable"), "caption")
    val radius = node.optInt("radiusDp", 8).coerceIn(0, 24)
    val renderedBitmap = if (radius > 0) roundImage(bitmap, radius, node.optInt("widthDp", 48).coerceIn(24, 240)) else bitmap
    return RemoteViews(pkg, if (node.optString("fit") == "contain") R.layout.wr_image_contain else R.layout.wr_image).apply {
      setImageViewBitmap(R.id.wr_image, renderedBitmap)
      setContentDescription(R.id.wr_image, node.optString("alt", item.optString("title", "Widget image")))
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        setViewLayoutWidth(R.id.wr_image, node.optInt("widthDp", 48).coerceIn(24, 240).toFloat(), TypedValue.COMPLEX_UNIT_DIP)
        setViewLayoutHeight(R.id.wr_image, node.optInt("heightDp", 48).coerceIn(24, 240).toFloat(), TypedValue.COMPLEX_UNIT_DIP)
      }
    }
  }

  private fun roundImage(bitmap: Bitmap, radiusDp: Int, widthDp: Int): Bitmap {
    val output = Bitmap.createBitmap(bitmap.width, bitmap.height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(output)
    val radius = (radiusDp.toFloat() * bitmap.width / widthDp).coerceAtMost(bitmap.width / 2f)
    val mask = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
    canvas.drawRoundRect(RectF(0f, 0f, bitmap.width.toFloat(), bitmap.height.toFloat()), radius, radius, mask)
    val imagePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_IN) }
    canvas.drawBitmap(bitmap, 0f, 0f, imagePaint)
    imagePaint.xfermode = null
    return output
  }

  private fun link(node: JSONObject): RemoteViews {
    val views = text(node.optString("label"), "body")
    val url = safeUrl(resolve(node.optString("urlBinding")))
    views.setTextColor(R.id.wr_text, palette.accent)
    if (url != null) {
      views.setContentDescription(R.id.wr_text, "Open ${node.optString("label")}")
      views.setOnClickPendingIntent(R.id.wr_text, openUrl(url))
    }
    return views
  }

  private fun decodeImage(encoded: String): Bitmap? {
    // The API caps downloaded images at 512 KB (about 683 KB of base64). Decode
    // bounds first and downsample before sending the bitmap through RemoteViews.
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
        val options = BitmapFactory.Options().apply { inSampleSize = sample }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)
      }
    }.getOrNull()
  }

  private fun clock(node: JSONObject) = RemoteViews(pkg, palette.clockLayout).apply {
    val format = node.optString("format", "12_hour")
    val seconds = node.optBoolean("showSeconds", false)
    val timeFormat = if (format == "24_hour") {
      if (seconds) "HH:mm:ss" else "HH:mm"
    } else {
      if (seconds) "h:mm:ss a" else "h:mm a"
    }
    setCharSequence(R.id.wr_clock_time, "setFormat12Hour", timeFormat)
    setCharSequence(R.id.wr_clock_time, "setFormat24Hour", timeFormat)
    setTextColor(R.id.wr_clock_time, palette.accent)
    setViewVisibility(R.id.wr_clock_date, if (node.optBoolean("showDate", false)) View.VISIBLE else View.GONE)
    setCharSequence(R.id.wr_clock_date, "setFormat12Hour", "EEE, MMM d")
    setCharSequence(R.id.wr_clock_date, "setFormat24Hour", "EEE, MMM d")
    setTextColor(R.id.wr_clock_date, palette.muted)
  }

  private fun list(node: JSONObject): RemoteViews {
    val views = RemoteViews(pkg, R.layout.wr_column)
    val items = data?.optJSONObject(node.optString("source"))?.optJSONArray("items") ?: JSONArray()
    val count = minOf(items.length(), node.optInt("maxItems", 3))
    if (count == 0) {
      views.addView(R.id.wr_container, text(if (data == null) "Loading…" else "Nothing here", "caption"))
      return views
    }
    for (i in 0 until count) {
      val item = items.getJSONObject(i)
      val row = RemoteViews(pkg, R.layout.wr_list_item)
      row.setTextViewText(R.id.wr_item_title, item.optString("title"))
      row.setTextColor(R.id.wr_item_title, palette.text)
      val repo = item.optString("repo")
      val number = item.optInt("number", 0)
      row.setTextViewText(R.id.wr_item_meta, if (number > 0) "$repo#$number" else repo)
      row.setTextColor(R.id.wr_item_meta, palette.muted)
      safeUrl(item.optString("url"))?.let { row.setOnClickPendingIntent(R.id.wr_item, openUrl(it)) }
      views.addView(R.id.wr_container, row)
    }
    return views
  }

  private fun streakChart(node: JSONObject): RemoteViews {
    val source = data?.optJSONObject(node.optString("source"))
    val summary = source?.optJSONObject("contributions")
    val days = summary?.optJSONArray("days") ?: JSONArray()
    val views = RemoteViews(pkg, R.layout.wr_column)
    val current = summary?.optInt("currentStreak")
    val best = summary?.optInt("longestStreak")
    val total = summary?.optInt("total")
    views.addView(R.id.wr_container, text(if (current == null) "–" else "$current day${if (current == 1) "" else "s"}", "title"))
    views.addView(R.id.wr_container, text(if (best == null) "Current streak · best –" else "Current streak · best $best", "caption"))
    for (rowIndex in 0 until 4) {
      val row = RemoteViews(pkg, R.layout.wr_row)
      for (column in 0 until 7) {
        val level = days.optJSONObject(rowIndex * 7 + column)?.optInt("level", 0)?.coerceIn(0, 4) ?: 0
        val color = when (level) {
          1 -> Color.parseColor("#0E4429")
          2 -> Color.parseColor("#006D32")
          3 -> Color.parseColor("#26A641")
          4 -> Color.parseColor("#39D353")
          else -> palette.divider
        }
        row.addView(R.id.wr_container, RemoteViews(pkg, R.layout.wr_streak_cell).apply {
          setInt(R.id.wr_streak_cell, "setBackgroundColor", color)
        })
      }
      views.addView(R.id.wr_container, row)
    }
    views.addView(R.id.wr_container, text(if (total == null) "Contribution data unavailable" else "Past year · $total contributions", "caption"))
    return views
  }

  private fun button(node: JSONObject) = RemoteViews(pkg, R.layout.wr_button).apply {
    setTextViewText(R.id.wr_button, template(node.optString("label")))
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      setTextColor(R.id.wr_button, materialOnColor(palette.accent))
      setColorStateList(R.id.wr_button, "setBackgroundTintList", ColorStateList.valueOf(palette.accent))
    } else {
      setTextColor(R.id.wr_button, materialOnColor(Color.parseColor("#6750A4")))
    }
    val action = node.optJSONObject("action")
    val intent = when (action?.optString("type")) {
      "open_url" -> safeUrl(resolve(action.optString("urlBinding")))?.let { openUrl(it) }
      "open_app" -> openApp()
      "refresh" -> refreshWidget()
      "lock_screen" -> lockScreenAction()
      else -> null
    }
    intent?.let { setOnClickPendingIntent(R.id.wr_button, it) }
  }

  private fun spacer(sizeDp: Int, inRow: Boolean): RemoteViews {
    // Spacer layouts are square, so one set works in rows and columns alike.
    val layout = when {
      sizeDp <= 5 -> R.layout.wr_spacer_4
      sizeDp <= 11 -> R.layout.wr_spacer_8
      sizeDp <= 23 -> R.layout.wr_spacer_16
      else -> R.layout.wr_spacer_32
    }
    return RemoteViews(pkg, layout)
  }

  /** Fills `{{binding}}` placeholders; anything unresolved shows as a dash. */
  private fun template(text: String): String = PLACEHOLDER.replace(text) { resolve(it.groupValues[1].trim()) ?: MISSING }

  /** `<source>.count` or `<source>.items[i].<field>` against the stored data. */
  private fun resolve(binding: String?): String? {
    val m = binding?.let { BINDING.matchEntire(it) } ?: return null
    val source = data?.optJSONObject(m.groupValues[1]) ?: return null
    if (m.groupValues[2].isEmpty()) return if (source.has("count")) source.optInt("count").toString() else null
    val item = source.optJSONArray("items")?.optJSONObject(m.groupValues[2].toInt()) ?: return null
    return item.opt(m.groupValues[3])?.toString()
  }

  private fun safeUrl(url: String?): String? = url?.takeIf {
    it.startsWith("https://") && Uri.parse(it).host?.isNotBlank() == true
  }

  private fun openUrl(url: String): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return PendingIntent.getActivity(context, requestCode(), intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  }

  private fun openApp(): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("$SCHEME://home?widget=$widgetId"))
      .setPackage(pkg)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return PendingIntent.getActivity(context, requestCode(), intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  }

  private fun refreshWidget(): PendingIntent {
    val intent = Intent(context, ComposerWidgetProvider::class.java)
      .setAction(ComposerWidgetProvider.ACTION_REFRESH)
      .putExtra(ComposerWidgetProvider.EXTRA_WIDGET_ID, widgetId)
    return PendingIntent.getBroadcast(context, requestCode(), intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  }

  /** Request codes must differ per click target, or Android merges the PendingIntents. */
  private fun requestCode() = appWidgetId * 1000 + nextRequestCode++

  private fun paletteFor(theme: String, fontFamily: String, custom: JSONObject?): Palette {
    val night = (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
    val dark = theme == "dark" || (theme == "system" && night)
    val defaults = if (dark) listOf("#141218", "#211F26", "#E6E1E5", "#CAC4D0", "#D0BCFF", "#938F99")
      else listOf("#FEF7FF", "#F7F2FA", "#1D1B20", "#49454F", "#6750A4", "#79747E")
    fun value(key: String, index: Int): Int {
      val candidate = custom?.optString(key)
      val hex = candidate?.takeIf { it.matches(Regex("^#[0-9a-fA-F]{6}$")) } ?: defaults[index]
      return Color.parseColor(hex)
    }
    return Palette(value("background", 0), value("surface", 1), value("text", 2), value("muted", 3), value("accent", 4), value("border", 5), clockLayout(fontFamily))
  }

  private fun clockLayout(fontFamily: String) = when (fontFamily) {
    "serif" -> R.layout.wr_clock_serif
    "monospace" -> R.layout.wr_clock_monospace
    else -> R.layout.wr_clock
  }

  private data class Palette(val background: Int, val surface: Int, val text: Int, val muted: Int, val accent: Int, val divider: Int, val clockLayout: Int)

  private companion object {
    const val MISSING = "–"
    const val SCHEME = "web2widgets"
    val PLACEHOLDER = Regex("""\{\{\s*([^{}]*?)\s*\}\}""")
    val BINDING = Regex("""^([a-z][a-z0-9_]{0,23})\.(?:count|items\[(\d{1,2})\]\.(title|url|repo|number|author|updatedAt|imageUrl|summary|publishedAt|sourceName))$""")
    val ASSET_BINDING = Regex("""^asset_[0-9a-f-]{36}$""", RegexOption.IGNORE_CASE)
  }
}
