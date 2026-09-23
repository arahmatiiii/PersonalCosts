package com.personalcost.app

import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.service.notification.NotificationListenerService
import com.personalcost.app.listener.BankNotificationListenerService
import com.personalcost.app.reminder.ReminderScheduler
import com.personalcost.app.sync.BankRulesSyncWorker

/** After reboot / app update: rebind the listener and make sure background work is scheduled. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        NotificationListenerService.requestRebind(ComponentName(context, BankNotificationListenerService::class.java))
        BankRulesSyncWorker.schedulePeriodic(context)
        BankRulesSyncWorker.runNow(context)
        ReminderScheduler.scheduleFromCache(context)
    }
}
