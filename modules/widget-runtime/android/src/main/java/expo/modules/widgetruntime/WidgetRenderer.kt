package expo.modules.widgetruntime

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.os.Build
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.net.Uri
import android.util.Base64
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONObject

/**
 * Legacy fallback renderer for WidgetSpec v1-v4 when Glance composition fails.
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
    root.setViewVisibility(R.id.wr_empty, View.GONE)
    root.removeAllViews(R.id.wr_content)
    root.addView(R.id.wr_content, RemoteViews(pkg, R.layout.wr_text_caption).apply {
      setTextViewText(R.id.wr_text, "Refresh")
      setTextColor(R.id.wr_text, palette.accent)
      setOnClickPendingIntent(R.id.wr_text, openApp(refresh = true))
    })
    root.addView(R.id.wr_content, node(spec.getJSONObject("root"), inRow = false))
    if (sample) {
      root.addView(R.id.wr_content, spacer(6, inRow = false))
      root.addView(R.id.wr_content, text("Sample data · connect GitHub in the app", "caption"))
    }
    root.setOnClickPendingIntent(R.id.wr_root, openApp())
    return root
  }

  private fun node(node: JSONObject, inRow: Boolean): RemoteViews =
    when (node.optString("type")) {
      "column", "row" -> container(node)
      "text" -> text(template(node.optString("text")), node.optString("style", "body")).apply {
        val defaultSize = when (node.optString("style", "body")) { "title" -> 17; "caption" -> 10; else -> 14 }
        setTextViewTextSize(R.id.wr_text, TypedValue.COMPLEX_UNIT_SP, node.optInt("fontSizeDp", defaultSize).coerceIn(10, 32).toFloat())
        setTextColor(R.id.wr_text, when (node.optString("colorToken")) { "accent" -> palette.accent; "muted" -> palette.muted; else -> palette.text })
      }
      "image" -> image(node)
      "link" -> link(node)
      "clock" -> clock(node)
      "metric" -> metric(node)
      "progress" -> progress(node)
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

  private fun text(value: String, style: String): RemoteViews {
    val layout = when (style) {
      "title" -> R.layout.wr_text_title
      "caption" -> R.layout.wr_text_caption
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
    return RemoteViews(pkg, if (node.optString("fit") == "contain") R.layout.wr_image_contain else R.layout.wr_image).apply {
      setImageViewBitmap(R.id.wr_image, bitmap)
      setContentDescription(R.id.wr_image, node.optString("alt", item.optString("title", "Widget image")))
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        setViewLayoutWidth(R.id.wr_image, node.optInt("widthDp", 48).coerceIn(24, 240).toFloat(), TypedValue.COMPLEX_UNIT_DIP)
        setViewLayoutHeight(R.id.wr_image, node.optInt("heightDp", 48).coerceIn(24, 240).toFloat(), TypedValue.COMPLEX_UNIT_DIP)
      }
    }
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
    val action = node.optJSONObject("action")
    val intent = when (action?.optString("type")) {
      "open_url" -> safeUrl(resolve(action.optString("urlBinding")))?.let { openUrl(it) }
      // Data is refreshed by the app, so both open it.
      "open_app" -> openApp()
      "refresh" -> openApp(refresh = true)
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

  private fun openApp(refresh: Boolean = false): PendingIntent {
    val query = if (refresh) "widget=$widgetId&refresh=true&ts=${System.currentTimeMillis()}" else "widget=$widgetId"
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("$SCHEME://home?$query"))
      .setPackage(pkg)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return PendingIntent.getActivity(context, requestCode(), intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  }

  /** Request codes must differ per click target, or Android merges the PendingIntents. */
  private fun requestCode() = appWidgetId * 1000 + nextRequestCode++

  private fun paletteFor(theme: String, fontFamily: String): Palette {
    val night = (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
    val dark = theme == "dark" || (theme == "system" && night)
    return if (dark) {
      Palette(R.drawable.wr_bg_dark, Color.parseColor("#FFFFFF"), Color.parseColor("#9AA39C"), Color.parseColor("#A6EF5C"), Color.parseColor("#2A2F2C"), clockLayout(fontFamily))
    } else {
      Palette(R.drawable.wr_bg_light, Color.parseColor("#111A14"), Color.parseColor("#5B665F"), Color.parseColor("#3C8C1E"), Color.parseColor("#E2E6E3"), clockLayout(fontFamily))
    }
  }

  private fun clockLayout(fontFamily: String) = when (fontFamily) {
    "serif" -> R.layout.wr_clock_serif
    "monospace" -> R.layout.wr_clock_monospace
    else -> R.layout.wr_clock
  }

  private data class Palette(val background: Int, val text: Int, val muted: Int, val accent: Int, val divider: Int, val clockLayout: Int)

  private companion object {
    const val MISSING = "–"
    const val SCHEME = "web2widgets"
    val PLACEHOLDER = Regex("""\{\{\s*([^{}]*?)\s*\}\}""")
    val BINDING = Regex("""^([a-z][a-z0-9_]{0,23})\.(?:count|items\[(\d{1,2})\]\.(title|url|repo|number|author|updatedAt|imageUrl))$""")
  }
}
