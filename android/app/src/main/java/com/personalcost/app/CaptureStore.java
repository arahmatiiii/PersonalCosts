package com.personalcost.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * Native-side persistence (SharedPreferences), shared by the SMS receiver, the reminder alarm and
 * the Capacitor plugin.
 *
 * SMS from bank senders are queued here because they arrive while the app (and its WebView) may be
 * closed. The JS side drains the queue on launch / resume, parses the texts and acks.
 * Parsing deliberately happens only in JS (src/lib/parser.ts) so there is one implementation.
 */
public final class CaptureStore {
    private static final String PREFS = "personalcost_native";
    private static final String KEY_QUEUE = "queue";
    private static final String KEY_SENDERS = "filter_senders";
    private static final String KEY_REMINDER_ENABLED = "reminder_enabled";
    private static final String KEY_REMINDER_HOUR = "reminder_hour";
    private static final String KEY_REMINDER_MINUTE = "reminder_minute";
    private static final String KEY_UNTAGGED = "untagged_count";
    private static final int MAX_QUEUE = 500;

    private CaptureStore() {}

    private static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    // ---------------------------------------------------------------- filters

    public static synchronized void setSenders(Context c, JSONArray senders) {
        prefs(c).edit().putString(KEY_SENDERS, senders.toString()).commit();
    }

    public static boolean matchesSender(Context c, String sender) {
        if (sender == null) return false;
        String s = normalizeSender(sender);
        for (String f : stringSet(prefs(c).getString(KEY_SENDERS, "[]"))) {
            if (!f.trim().isEmpty() && normalizeSender(f).equals(s)) return true;
        }
        return false;
    }

    /** Same rules as normalizeSender() in src/lib/parser.ts — keep in sync. */
    static String normalizeSender(String raw) {
        StringBuilder b = new StringBuilder();
        for (char ch : raw.toCharArray()) {
            if (ch >= '۰' && ch <= '۹') ch = (char) ('0' + (ch - '۰'));
            else if (ch >= '٠' && ch <= '٩') ch = (char) ('0' + (ch - '٠'));
            if (Character.isLetterOrDigit(ch)) b.append(ch);
        }
        String s = b.toString().toLowerCase(Locale.ROOT);
        if (s.matches("\\d+")) {
            if (s.startsWith("0098")) s = s.substring(4);
            else if (s.startsWith("98") && s.length() > 10) s = s.substring(2);
            else if (s.startsWith("0")) s = s.substring(1);
        }
        return s;
    }

    private static Set<String> stringSet(String json) {
        Set<String> out = new HashSet<>();
        try {
            JSONArray a = new JSONArray(json);
            for (int i = 0; i < a.length(); i++) out.add(a.getString(i));
        } catch (JSONException ignored) {
        }
        return out;
    }

    // ---------------------------------------------------------------- queue

    public static synchronized void enqueue(Context c, String sender, String text, long ts) {
        JSONArray q = queue(c);
        try {
            q.put(new JSONObject()
                    .put("id", UUID.randomUUID().toString())
                    .put("sender", sender)
                    .put("text", text)
                    .put("ts", ts));
        } catch (JSONException e) {
            return;
        }
        while (q.length() > MAX_QUEUE) q.remove(0);
        prefs(c).edit().putString(KEY_QUEUE, q.toString()).commit();
        PersonalCostPlugin.notifyCapture();
    }

    public static synchronized JSONArray queue(Context c) {
        try {
            return new JSONArray(prefs(c).getString(KEY_QUEUE, "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    public static synchronized void ack(Context c, Set<String> ids) {
        JSONArray q = queue(c);
        JSONArray kept = new JSONArray();
        for (int i = 0; i < q.length(); i++) {
            JSONObject o = q.optJSONObject(i);
            if (o != null && !ids.contains(o.optString("id"))) kept.put(o);
        }
        prefs(c).edit().putString(KEY_QUEUE, kept.toString()).commit();
    }

    public static synchronized int pending(Context c) {
        return queue(c).length();
    }

    // ---------------------------------------------------------------- reminder

    public static void setReminder(Context c, boolean enabled, int hour, int minute) {
        prefs(c).edit()
                .putBoolean(KEY_REMINDER_ENABLED, enabled)
                .putInt(KEY_REMINDER_HOUR, hour)
                .putInt(KEY_REMINDER_MINUTE, minute)
                .commit();
    }

    public static boolean reminderEnabled(Context c) {
        return prefs(c).getBoolean(KEY_REMINDER_ENABLED, true);
    }

    public static int reminderHour(Context c) {
        return prefs(c).getInt(KEY_REMINDER_HOUR, 22);
    }

    public static int reminderMinute(Context c) {
        return prefs(c).getInt(KEY_REMINDER_MINUTE, 0);
    }

    public static void setUntaggedCount(Context c, int count) {
        prefs(c).edit().putInt(KEY_UNTAGGED, count).commit();
    }

    public static int untaggedCount(Context c) {
        return prefs(c).getInt(KEY_UNTAGGED, 0);
    }
}
