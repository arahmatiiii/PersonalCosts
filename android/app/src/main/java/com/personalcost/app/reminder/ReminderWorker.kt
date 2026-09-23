package com.personalcost.app.reminder

import android.Manifest
import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.personalcost.app.BuildConfig
import com.personalcost.app.PersonalCostApp
import com.personalcost.app.R
import com.personalcost.app.auth.FirebaseAuthManager
import com.personalcost.app.data.BankRulesCache
import com.personalcost.app.data.FirestoreRepository
import kotlinx.coroutines.withTimeoutOrNull

class ReminderWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        // Prefer fresh settings (the time may have changed from the web), fall back to the cached copy.
        val settings = withTimeoutOrNull(10_000) {
            runCatching { BankRulesCache.refresh() }.getOrNull()
        } ?: BankRulesCache.cachedReminder

        try {
            if (settings.enabled && FirebaseAuthManager.isSignedIn) {
                val count = withTimeoutOrNull(15_000) { FirestoreRepository.countUntagged() }
                if (count != null && count > 0) notify(count)
            }
        } catch (e: Exception) {
            Log.w("ReminderWorker", "could not count untagged transactions", e)
        } finally {
            ReminderScheduler.schedule(applicationContext, settings, fromReminderWorker = true)
        }
        return Result.success()
    }

    @SuppressLint("MissingPermission") // checked right below
    private fun notify(count: Long) {
        val ctx = applicationContext
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return

        // Tagging happens in the PWA; tapping opens it (Chrome hands the URL to the installed PWA).
        val open = PendingIntent.getActivity(
            ctx, 0,
            Intent(Intent.ACTION_VIEW, Uri.parse(BuildConfig.PWA_URL)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val n = NotificationCompat.Builder(ctx, PersonalCostApp.CHANNEL_REMINDER)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("$count تراکنش تگ‌نخورده")
            .setContentText("بزن ببینم چی بوده")
            .setContentIntent(open)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()
        NotificationManagerCompat.from(ctx).notify(NOTIFICATION_ID, n)
    }

    companion object {
        private const val NOTIFICATION_ID = 22
    }
}
