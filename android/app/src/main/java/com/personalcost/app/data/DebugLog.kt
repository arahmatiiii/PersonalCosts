package com.personalcost.app.data

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Local ring buffer of raw captured texts and what the parser did with them. Use it during the first
 * weeks to verify package names / sender ids / regexes: a wrong regex silently drops transactions,
 * and this is where you'd see it. Never leaves the device.
 */
object DebugLog {
    private const val PREFS = "debug_log"
    private const val KEY = "entries"
    private const val KEY_CAPTURE_ALL = "capture_all"
    private const val MAX = 150

    private lateinit var prefs: SharedPreferences

    fun init(context: Context) {
        prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    }

    /** When on, logs every notification's package + text (to discover a bank app's package name). */
    var captureAll: Boolean
        get() = prefs.getBoolean(KEY_CAPTURE_ALL, false)
        set(v) = prefs.edit().putBoolean(KEY_CAPTURE_ALL, v).apply()

    @Synchronized
    fun log(status: String, origin: String, text: String) {
        val arr = try { JSONArray(prefs.getString(KEY, "[]")) } catch (e: Exception) { JSONArray() }
        arr.put(JSONObject().put("t", System.currentTimeMillis()).put("s", status).put("o", origin).put("x", text.take(600)))
        while (arr.length() > MAX) arr.remove(0)
        prefs.edit().putString(KEY, arr.toString()).apply()
    }

    @Synchronized
    fun dump(): String {
        val arr = try { JSONArray(prefs.getString(KEY, "[]")) } catch (e: Exception) { JSONArray() }
        val fmt = SimpleDateFormat("MM-dd HH:mm:ss", Locale.US)
        return (arr.length() - 1 downTo 0).joinToString("\n\n") { i ->
            val o = arr.getJSONObject(i)
            "[${fmt.format(Date(o.getLong("t")))}] ${o.getString("s")} ← ${o.getString("o")}\n${o.getString("x")}"
        }.ifEmpty { "(empty)" }
    }

    @Synchronized
    fun clear() = prefs.edit().remove(KEY).apply()
}
