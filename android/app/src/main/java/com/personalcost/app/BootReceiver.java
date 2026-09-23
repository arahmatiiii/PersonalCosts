package com.personalcost.app;

import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.service.notification.NotificationListenerService;

/** After a reboot or app update: rebind the notification listener and re-arm the reminder alarm. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        NotificationListenerService.requestRebind(new ComponentName(context, BankNotificationListener.class));
        ReminderReceiver.schedule(context);
    }
}
