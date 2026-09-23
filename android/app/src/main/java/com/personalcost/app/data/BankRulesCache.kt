package com.personalcost.app.data

import android.content.Context
import android.content.SharedPreferences
import com.personalcost.app.parsing.BankRule
import org.json.JSONArray
import org.json.JSONObject

/**
 * In-memory copy of the Firestore `banks` collection, persisted to SharedPreferences so rules are
 * available even if a notification arrives while the phone is offline (or right after a reboot).
 * Also caches the reminder settings for the same reason.
 */
object BankRulesCache {
    private const val PREFS = "bank_rules_cache"
    private const val KEY_RULES = "rules"
    private const val KEY_LAST_SYNC = "last_sync"
    private const val KEY_LAST_ERROR = "last_error"
    private const val KEY_REMINDER = "reminder"

    @Volatile private var rules: List<BankRule>? = null
    private lateinit var prefs: SharedPreferences

    fun init(context: Context) {
        prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        rules = prefs.getString(KEY_RULES, null)?.let(::decode)
    }

    /** True once rules have been fetched at least once (possibly in a previous process). */
    val isLoaded: Boolean get() = rules != null

    val all: List<BankRule> get() = rules.orEmpty()
    val enabled: List<BankRule> get() = all.filter { it.enabled }

    val lastSyncMillis: Long get() = prefs.getLong(KEY_LAST_SYNC, 0L)
    val lastError: String? get() = prefs.getString(KEY_LAST_ERROR, null)

    fun forPackage(packageName: String): List<BankRule> = enabled.filter { it.matchesPackage(packageName) }
    fun forSender(address: String?): List<BankRule> = enabled.filter { it.matchesSender(address) }

    /** Fetches rules + reminder settings from Firestore. Returns the reminder settings on success. */
    suspend fun refresh(): FirestoreRepository.ReminderSettings {
        try {
            val fresh = FirestoreRepository.fetchBanks()
            val reminder = FirestoreRepository.fetchReminderSettings()
            rules = fresh
            prefs.edit()
                .putString(KEY_RULES, encode(fresh))
                .putLong(KEY_LAST_SYNC, System.currentTimeMillis())
                .putString(KEY_REMINDER, JSONObject().put("h", reminder.hour).put("m", reminder.minute).put("e", reminder.enabled).toString())
                .remove(KEY_LAST_ERROR)
                .apply()
            return reminder
        } catch (e: Exception) {
            prefs.edit().putString(KEY_LAST_ERROR, "${e.javaClass.simpleName}: ${e.message}").apply()
            throw e
        }
    }

    val cachedReminder: FirestoreRepository.ReminderSettings
        get() = prefs.getString(KEY_REMINDER, null)?.let {
            val o = JSONObject(it)
            FirestoreRepository.ReminderSettings(o.getInt("h"), o.getInt("m"), o.getBoolean("e"))
        } ?: FirestoreRepository.ReminderSettings()

    private fun encode(list: List<BankRule>): String = JSONArray().apply {
        list.forEach { r ->
            put(
                JSONObject()
                    .put("id", r.id)
                    .put("name", r.name)
                    .put("matchPackages", JSONArray(r.matchPackages))
                    .put("matchSenderIds", JSONArray(r.matchSenderIds))
                    .put("regexAmount", r.regexAmount)
                    .put("incomeKeywords", JSONArray(r.incomeKeywords))
                    .put("expenseKeywords", JSONArray(r.expenseKeywords))
                    .put("enabled", r.enabled)
                    .put("isDefault", r.isDefault)
            )
        }
    }.toString()

    private fun decode(json: String): List<BankRule>? = try {
        val arr = JSONArray(json)
        (0 until arr.length()).map { i ->
            val o = arr.getJSONObject(i)
            fun list(k: String) = o.optJSONArray(k)?.let { a -> (0 until a.length()).map { a.getString(it) } } ?: emptyList()
            BankRule(
                id = o.getString("id"),
                name = o.getString("name"),
                matchPackages = list("matchPackages"),
                matchSenderIds = list("matchSenderIds"),
                regexAmount = o.getString("regexAmount"),
                incomeKeywords = list("incomeKeywords"),
                expenseKeywords = list("expenseKeywords"),
                enabled = o.optBoolean("enabled", true),
                isDefault = o.optBoolean("isDefault", false),
            )
        }
    } catch (e: Exception) {
        null
    }
}
