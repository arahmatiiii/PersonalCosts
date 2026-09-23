package com.personalcost.app.sync

import android.content.Context
import android.util.Log
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.personalcost.app.auth.FirebaseAuthManager
import com.personalcost.app.data.BankRulesCache
import com.personalcost.app.ingest.TransactionIngestor
import com.personalcost.app.reminder.ReminderScheduler
import java.util.concurrent.TimeUnit

/**
 * Pulls `banks` + `settings/user` from Firestore (so banks added from the web Settings page take effect
 * without reinstalling), reschedules the reminder if its time changed, and reprocesses queued captures.
 */
class BankRulesSyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        if (!FirebaseAuthManager.isSignedIn) return Result.success()
        return try {
            val reminder = BankRulesCache.refresh()
            ReminderScheduler.schedule(applicationContext, reminder)
            TransactionIngestor.drainPending()
            Result.success()
        } catch (e: Exception) {
            Log.w(TAG, "sync failed", e)
            if (runAttemptCount < 5) Result.retry() else Result.failure()
        }
    }

    companion object {
        private const val TAG = "BankRulesSync"
        private const val PERIODIC = "bank-rules-sync-periodic"
        private const val ONE_SHOT = "bank-rules-sync-now"

        private val networkConstraint = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

        fun schedulePeriodic(context: Context) {
            val req = PeriodicWorkRequestBuilder<BankRulesSyncWorker>(6, TimeUnit.HOURS)
                .setConstraints(networkConstraint)
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP, req)
        }

        fun runNow(context: Context) {
            val req = OneTimeWorkRequestBuilder<BankRulesSyncWorker>().setConstraints(networkConstraint).build()
            WorkManager.getInstance(context).enqueueUniqueWork(ONE_SHOT, ExistingWorkPolicy.KEEP, req)
        }
    }
}
