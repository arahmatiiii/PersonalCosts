package com.personalcost.app;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.text.TextUtils;

import java.util.LinkedHashSet;
import java.util.Set;

/** Queues notifications posted by bank apps (see CaptureStore filters). */
public class BankNotificationListener extends NotificationListenerService {

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        String pkg = sbn.getPackageName();
        if (pkg == null || pkg.equals(getPackageName())) return;
        Notification n = sbn.getNotification();
        if (n == null) return;
        // Group summaries repeat their children's content; ongoing ones are media/progress noise.
        if ((n.flags & Notification.FLAG_GROUP_SUMMARY) != 0 || sbn.isOngoing()) return;

        boolean matched = CaptureStore.matchesPackage(this, pkg);
        if (!matched && !CaptureStore.captureAll(this)) return;

        String text = extractText(n);
        if (text.isEmpty()) return;
        CaptureStore.enqueue(this, "notification", pkg, text, sbn.getPostTime(), matched);
    }

    /**
     * Bank apps format notifications differently: some use EXTRA_TEXT, some BigTextStyle, some
     * InboxStyle lines, and some put the amount in the title. Combine them all.
     */
    static String extractText(Notification n) {
        Bundle e = n.extras;
        if (e == null) return "";
        CharSequence title = e.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence big = e.getCharSequence(Notification.EXTRA_BIG_TEXT);
        CharSequence text = e.getCharSequence(Notification.EXTRA_TEXT);
        CharSequence[] lines = e.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);

        Set<String> parts = new LinkedHashSet<>();
        add(parts, title);
        add(parts, big != null && big.toString().trim().length() > 0 ? big : text);
        if (lines != null) for (CharSequence l : lines) add(parts, l);
        return TextUtils.join("\n", parts);
    }

    private static void add(Set<String> parts, CharSequence cs) {
        if (cs == null) return;
        String s = cs.toString().trim();
        if (!s.isEmpty()) parts.add(s);
    }
}
