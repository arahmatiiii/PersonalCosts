package com.personalcost.app.data

import android.util.Log
import com.google.firebase.Timestamp
import com.google.firebase.firestore.AggregateSource
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Source
import com.personalcost.app.parsing.BankRule
import com.personalcost.app.parsing.ParserEngine
import kotlinx.coroutines.tasks.await
import java.util.Date

object FirestoreRepository {
    private const val TAG = "FirestoreRepository"
    private val db: FirebaseFirestore get() = FirebaseFirestore.getInstance()

    data class ReminderSettings(val hour: Int = 22, val minute: Int = 0, val enabled: Boolean = true)

    /**
     * Fire-and-forget write. Firestore's offline persistence queues it locally and syncs when
     * connectivity returns, so we deliberately do NOT await the server ack (a BroadcastReceiver
     * only has a few seconds, and offline the Task wouldn't complete until we're back online).
     */
    fun insertTransaction(tx: ParserEngine.ParsedTransaction) {
        val data = hashMapOf<String, Any?>(
            "amount" to tx.amount,
            "type" to tx.type,
            "bankId" to tx.bankId,
            "timestamp" to Timestamp(Date(tx.timestamp)),
            "rawText" to tx.rawText,
            "source" to tx.source.firestoreValue,
            "tag" to null,
            "note" to if (tx.typeUncertain) ParserEngine.UNCLEAR_TYPE_NOTE else null,
            "tagged" to false,
            "typeUncertain" to tx.typeUncertain,
            "createdAt" to FieldValue.serverTimestamp(),
        )
        db.collection("transactions").document().set(data)
            .addOnFailureListener { Log.e(TAG, "insertTransaction failed", it) }
    }

    suspend fun fetchBanks(): List<BankRule> =
        db.collection("banks").get(Source.SERVER).await().documents.mapNotNull(::toBankRule)

    suspend fun fetchReminderSettings(): ReminderSettings {
        val doc = db.collection("settings").document("user").get(Source.SERVER).await()
        return ReminderSettings(
            hour = doc.getLong("reminderHour")?.toInt() ?: 22,
            minute = doc.getLong("reminderMinute")?.toInt() ?: 0,
            enabled = doc.getBoolean("reminderEnabled") ?: true,
        )
    }

    /** Number of transactions still waiting for a tag. Falls back to the local cache when offline. */
    suspend fun countUntagged(): Long {
        val q = db.collection("transactions").whereEqualTo("tagged", false)
        return try {
            q.count().get(AggregateSource.SERVER).await().count
        } catch (e: Exception) {
            Log.w(TAG, "count from server failed, using cache", e)
            q.get(Source.CACHE).await().size().toLong()
        }
    }

    @Suppress("UNCHECKED_CAST")
    private fun toBankRule(doc: DocumentSnapshot): BankRule? {
        fun list(field: String) = (doc.get(field) as? List<*>)?.mapNotNull { it as? String } ?: emptyList()
        val regex = doc.getString("regexAmount") ?: return null
        return BankRule(
            id = doc.id,
            name = doc.getString("name") ?: doc.id,
            matchPackages = list("matchPackages"),
            matchSenderIds = list("matchSenderIds"),
            regexAmount = regex,
            incomeKeywords = list("incomeKeywords"),
            expenseKeywords = list("expenseKeywords"),
            enabled = doc.getBoolean("enabled") ?: true,
            isDefault = doc.getBoolean("isDefault") ?: false,
        )
    }
}
