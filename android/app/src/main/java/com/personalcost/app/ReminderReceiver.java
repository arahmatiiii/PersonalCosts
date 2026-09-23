package com.personalcost.app;

import android.Manifest;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import java.util.Calendar;

/**
 * Daily "N untagged transactions" reminder. Fired by AlarmManager, so it works with the app closed;
 * the count comes from what the WebView last reported plus bank captures still waiting in the queue.
 */
public class ReminderReceiver extends BroadcastReceiver {
    private static final String CHANNEL = "reminder";
    private static final int NOTIFICATION_ID = 22;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (CaptureStore.reminderEnabled(context)) {
            int count = CaptureStore.untaggedCount(context) + CaptureStore.pendingMatched(context);
            if (count > 0) show(context, count);
        }
        schedule(context); // tomorrow
    }

    /** (Re)schedules the next alarm from the stored settings, or cancels it when disabled. */
    public static void schedule(Context context) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        PendingIntent pi = PendingIntent.getBroadcast(
                context, 0, new Intent(context, ReminderReceiver.class),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        am.cancel(pi);
        if (!CaptureStore.reminderEnabled(context)) return;

        Calendar next = Calendar.getInstance();
        next.set(Calendar.HOUR_OF_DAY, CaptureStore.reminderHour(context));
        next.set(Calendar.MINUTE, CaptureStore.reminderMinute(context));
        next.set(Calendar.SECOND, 0);
        next.set(Calendar.MILLISECOND, 0);
        if (next.getTimeInMillis() <= System.currentTimeMillis() + 30_000) next.add(Calendar.DAY_OF_YEAR, 1);
        // Inexact-but-Doze-safe: may fire a few minutes late, needs no exact-alarm permission.
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), pi);
    }

    private static void show(Context context, int count) {
        if (Build.VERSION.SDK_INT >= 33
                && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 26) {
            nm.createNotificationChannel(new NotificationChannel(CHANNEL, "یادآور تگ‌زدن", NotificationManager.IMPORTANCE_DEFAULT));
        }
        PendingIntent open = PendingIntent.getActivity(
                context, 0,
                new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        NotificationCompat.Builder b = new NotificationCompat.Builder(context, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_notify)
                .setContentTitle(count + " تراکنش تگ‌نخورده")
                .setContentText("بزن ببینم چی بوده")
                .setContentIntent(open)
                .setAutoCancel(true);
        try {
            NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, b.build());
        } catch (SecurityException ignored) {
        }
    }
}
