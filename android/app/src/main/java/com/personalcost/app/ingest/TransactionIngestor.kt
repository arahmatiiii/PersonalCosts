package com.personalcost.app.ingest

import android.content.Context
import com.personalcost.app.auth.FirebaseAuthManager
import com.personalcost.app.data.BankRulesCache
import com.personalcost.app.data.DebugLog
import com.personalcost.app.data.Deduplicator
import com.personalcost.app.data.FirestoreRepository
import com.personalcost.app.data.PendingQueue
import com.personalcost.app.parsing.BankRule
import com.personalcost.app.parsing.ParserEngine
import com.personalcost.app.parsing.ParserEngine.Source
import com.personalcost.app.sync.BankRulesSyncWorker

/** Single entry point shared by the notification listener and the SMS receiver. */
object TransactionIngestor {

    /**
     * @param origin the notification's package name, or the SMS sender address.
     */
    fun ingest(context: Context, source: Source, origin: String, text: String, timestamp: Long) {
        if (text.isBlank()) return

        if (!BankRulesCache.isLoaded) {
            // Rules never synced, so we can't tell whether this is a bank message: keep the raw text
            // and retry once the first sync completes.
            PendingQueue.add(PendingQueue.Item(source, origin, text, timestamp))
            DebugLog.log("QUEUED (bank rules not synced yet)", origin, text)
            BankRulesSyncWorker.runNow(context)
            return
        }

        val rules = rulesFor(source, origin)
        if (rules.isEmpty()) return

        if (!FirebaseAuthManager.isSignedIn) {
            // A write made while signed out would be rejected by the security rules and lost.
            PendingQueue.add(PendingQueue.Item(source, origin, text, timestamp))
            DebugLog.log("QUEUED (not signed in)", origin, text)
            return
        }

        process(rules, source, origin, text, timestamp)
    }

    /** Re-runs captures queued while rules/auth were unavailable. Call after a successful sync. */
    fun drainPending() {
        if (!BankRulesCache.isLoaded || !FirebaseAuthManager.isSignedIn) return
        for (item in PendingQueue.drain()) {
            val rules = rulesFor(item.source, item.origin)
            if (rules.isNotEmpty()) process(rules, item.source, item.origin, item.text, item.timestamp)
        }
    }

    private fun rulesFor(source: Source, origin: String): List<BankRule> = when (source) {
        Source.NOTIFICATION -> BankRulesCache.forPackage(origin)
        Source.SMS -> BankRulesCache.forSender(origin)
    }

    private fun process(rules: List<BankRule>, source: Source, origin: String, text: String, timestamp: Long) {
        // Several rules may share a package/sender; the first whose regex matches wins.
        val failures = mutableListOf<String>()
        for (rule in rules) {
            when (val out = ParserEngine.parseDetailed(rule, text, source, timestamp)) {
                is ParserEngine.Outcome.Parsed -> {
                    val tx = out.tx
                    if (Deduplicator.checkAndRecord(tx)) {
                        FirestoreRepository.insertTransaction(tx)
                        DebugLog.log("SAVED ${rule.name}: ${tx.amount} ${tx.type}${if (tx.typeUncertain) " (uncertain)" else ""}", origin, text)
                    } else {
                        DebugLog.log("DUPLICATE ${rule.name}: ${tx.amount}", origin, text)
                    }
                    return
                }
                is ParserEngine.Outcome.Failed -> failures += "${rule.name}: ${out.reason}"
            }
        }
        DebugLog.log("UNPARSED — ${failures.joinToString("; ")}", origin, text)
    }
}
