package com.personalcost.app.data

import android.content.Context
import android.content.SharedPreferences
import com.personalcost.app.parsing.ParserEngine
import org.json.JSONArray
import org.json.JSONObject

/**
 * Banks often send both an SMS and an app notification for the same transaction, and apps re-post
 * notifications on update. A new capture is a duplicate if, within the last 2 minutes, we already
 * inserted one for the same bank + amount that either has the identical raw text, or came from the
 * other channel (SMS vs notification — their texts usually differ).
 *
 * Kept locally (not queried from Firestore) so it works offline and needs no composite index.
 */
object Deduplicator {
    private const val PREFS = "dedup"
    private const val KEY = "recent"
    const val WINDOW_MS = 2 * 60 * 1000L

    private lateinit var prefs: SharedPreferences

    fun init(context: Context) {
        prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    }

    /** Returns true (and records it) if [tx] is new; false if it's a duplicate. */
    @Synchronized
    fun checkAndRecord(tx: ParserEngine.ParsedTransaction, now: Long = System.currentTimeMillis()): Boolean {
        val arr = try { JSONArray(prefs.getString(KEY, "[]")) } catch (e: Exception) { JSONArray() }
        val kept = JSONArray()
        var duplicate = false
        for (i in 0 until arr.length()) {
            val o = arr.getJSONObject(i)
            if (now - o.getLong("t") > WINDOW_MS) continue
            kept.put(o)
            if (o.getString("b") == tx.bankId && o.getLong("a") == tx.amount &&
                (o.getInt("h") == tx.rawText.hashCode() || o.getString("s") != tx.source.name)
            ) duplicate = true
        }
        if (!duplicate) {
            kept.put(JSONObject().put("t", now).put("b", tx.bankId).put("a", tx.amount).put("h", tx.rawText.hashCode()).put("s", tx.source.name))
        }
        prefs.edit().putString(KEY, kept.toString()).commit()
        return !duplicate
    }
}
