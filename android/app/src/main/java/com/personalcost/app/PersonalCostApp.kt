package com.personalcost.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import com.personalcost.app.data.BankRulesCache
import com.personalcost.app.data.DebugLog
import com.personalcost.app.data.Deduplicator
import com.personalcost.app.data.PendingQueue
import com.personalcost.app.reminder.ReminderScheduler
import com.personalcost.app.sync.BankRulesSyncWorker

class PersonalCostApp : Application() {
    override fun onCreate() {
        super.onCreate()
        BankRulesCache.init(this)
        PendingQueue.init(this)
        DebugLog.init(this)
        Deduplicator.init(this)

        getSystemService(NotificationManager::class.java).createNotificationChannel(
            NotificationChannel(CHANNEL_REMINDER, getString(R.string.channel_reminder), NotificationManager.IMPORTANCE_DEFAULT)
        )

        BankRulesSyncWorker.schedulePeriodic(this)
        BankRulesSyncWorker.runNow(this)
        ReminderScheduler.scheduleFromCache(this)
    }

    companion object {
        const val CHANNEL_REMINDER = "reminder"
    }
}
