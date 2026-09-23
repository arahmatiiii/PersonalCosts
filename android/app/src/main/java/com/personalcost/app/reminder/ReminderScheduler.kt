package com.personalcost.app.reminder

import android.content.Context
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.personalcost.app.data.BankRulesCache
import com.personalcost.app.data.FirestoreRepository.ReminderSettings
import java.util.Calendar
import java.util.concurrent.TimeUnit

/**
 * The daily reminder is a self-rescheduling one-time work request: each run schedules the next one
 * for the configured time. (A 24h PeriodicWorkRequest drifts and can't be pinned to a clock time.)
 */
object ReminderScheduler {
    private const val WORK = "daily-reminder"
    private const val PREFS = "reminder_scheduler"
    private const val KEY_LAST = "last_scheduled"

    /**
     * @param fromReminderWorker true when called by the running [ReminderWorker] to queue tomorrow's run.
     */
    fun schedule(context: Context, s: ReminderSettings, fromReminderWorker: Boolean = false) {
        val wm = WorkManager.getInstance(context)
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val key = "${s.enabled}:${s.hour}:${s.minute}"
        val changed = prefs.getString(KEY_LAST, null) != key
        prefs.edit().putString(KEY_LAST, key).apply()

        if (!s.enabled) {
            wm.cancelUniqueWork(WORK)
            return
        }
        val policy = when {
            // Queue behind the currently running worker instead of cancelling it.
            fromReminderWorker -> ExistingWorkPolicy.APPEND_OR_REPLACE
            // Time changed from the web: drop the pending run and schedule at the new time.
            changed -> ExistingWorkPolicy.REPLACE
            // Otherwise (app start, boot, periodic sync) leave an already-pending run alone.
            else -> ExistingWorkPolicy.KEEP
        }
        val req = OneTimeWorkRequestBuilder<ReminderWorker>()
            .setInitialDelay(delayUntil(s.hour, s.minute), TimeUnit.MILLISECONDS)
            .build()
        wm.enqueueUniqueWork(WORK, policy, req)
    }

    fun scheduleFromCache(context: Context) = schedule(context, BankRulesCache.cachedReminder)

    fun delayUntil(hour: Int, minute: Int, now: Calendar = Calendar.getInstance()): Long {
        val next = (now.clone() as Calendar).apply {
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
            // Small grace so a run that fires a few seconds early doesn't schedule itself again today.
            if (timeInMillis <= now.timeInMillis + 60_000) add(Calendar.DAY_OF_YEAR, 1)
        }
        return next.timeInMillis - now.timeInMillis
    }
}
