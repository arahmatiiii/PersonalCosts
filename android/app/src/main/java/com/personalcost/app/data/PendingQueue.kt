package com.personalcost.app.data

import android.content.Context
import android.content.SharedPreferences
import com.personalcost.app.parsing.ParserEngine
import org.json.JSONArray
import org.json.JSONObject

/**
 * Raw captures we couldn't process yet — rules never synced, or not signed in (a write made while
 * signed out would be rejected by the security rules and lost). Reprocessed after the next sync.
 */
object PendingQueue {
    private const val PREFS = "pending_queue"
    private const val KEY = "items"
    private const val MAX_ITEMS = 200

    data class Item(val source: ParserEngine.Source, val origin: String, val text: String, val timestamp: Long)

    private lateinit var prefs: SharedPreferences

    fun init(context: Context) {
        prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    }

    @Synchronized
    fun add(item: Item) {
        val arr = load()
        arr.put(
            JSONObject()
                .put("source", item.source.name)
                .put("origin", item.origin)
                .put("text", item.text)
                .put("ts", item.timestamp)
        )
        while (arr.length() > MAX_ITEMS) arr.remove(0)
        prefs.edit().putString(KEY, arr.toString()).apply()
    }

    @Synchronized
    fun drain(): List<Item> {
        val arr = load()
        prefs.edit().remove(KEY).apply()
        return (0 until arr.length()).map {
            val o = arr.getJSONObject(it)
            Item(ParserEngine.Source.valueOf(o.getString("source")), o.getString("origin"), o.getString("text"), o.getLong("ts"))
        }
    }

    val size: Int @Synchronized get() = load().length()

    private fun load(): JSONArray = try {
        JSONArray(prefs.getString(KEY, "[]"))
    } catch (e: Exception) {
        JSONArray()
    }
}
