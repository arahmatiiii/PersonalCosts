package com.personalcost.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Heads-up notification shown the moment a bank SMS arrives, with the most used tags as buttons, so
 * it can be tagged without opening the app. An expense tag is followed by a second step: which «پول»
 * paid for it. The pick is stored natively (CaptureStore.addTagChoice) and applied by the JS side
 * when it reads the SMS (src/native/bridge.ts applyTagChoices).
 *
 * The amount and the expense/income guess here are only for what the notification shows; the real
 * parsing stays in JS (src/lib/parser.ts).
 */
public final class TagNotifier {
    static final String CHANNEL = "sms_tag";
    private static final int NOTIFICATION_ID = 7;
    private static final int[] CHIPS = {
            R.id.notif_chip0, R.id.notif_chip1, R.id.notif_chip2, R.id.notif_chip3,
            R.id.notif_chip4, R.id.notif_chip5, R.id.notif_chip6, R.id.notif_chip7,
    };

    static final String EXTRA_CAPTURE = "captureId";
    static final String EXTRA_TAG = "tag";
    static final String EXTRA_KIND = "kind";
    static final String EXTRA_FUND = "fund";
    static final String EXTRA_STEP = "step";
    static final String EXTRA_HEADLINE = "headline";
    static final String STEP_TAG = "tag";
    static final String STEP_FUND = "fund";

    private TagNotifier() {}

    /** Step 1: «این چی بود؟» with tag buttons. */
    static void showTags(Context c, String captureId, String text) {
        JSONObject opts = CaptureStore.tagOptions(c);
        if (!opts.optBoolean("enabled", true) || !canNotify(c) || isCode(text)) return;
        Guess g = guess(text);
        String kind = "income".equals(g.kind) ? "income" : "expense";
        List<String> labels = strings(opts.optJSONArray(kind));
        String headline = (g.amount != null ? g.amount + " · " : "") + ("income".equals(kind) ? "واریز" : "برداشت");
        String question = labels.isEmpty()
                ? "برای تگ‌زدن بزن"
                : ("income".equals(kind) ? "این درآمد کدام پول است؟" : "این چی بود؟");

        List<PendingIntent> actions = new ArrayList<>();
        for (int i = 0; i < Math.min(labels.size(), CHIPS.length); i++) {
            actions.add(action(c, captureId, i, STEP_TAG, labels.get(i), kind, null, headline));
        }
        post(c, captureId, headline, question, oneLine(text), labels, actions, false);
    }

    /** Step 2 (expenses): which «پول» paid for it, or none. */
    static void showFunds(Context c, String captureId, String tag, String headline) {
        List<String> funds = strings(CaptureStore.tagOptions(c).optJSONArray("payFrom"));
        List<String> labels = new ArrayList<>(funds.subList(0, Math.min(funds.size(), CHIPS.length - 1)));
        List<PendingIntent> actions = new ArrayList<>();
        for (int i = 0; i < labels.size(); i++) {
            actions.add(action(c, captureId, i, STEP_FUND, tag, "expense", labels.get(i), headline));
        }
        labels.add("هیچ‌کدام");
        actions.add(action(c, captureId, labels.size() - 1, STEP_FUND, tag, "expense", null, headline));
        post(c, captureId, headline, "«" + tag + "» · از کدام پول؟", null, labels, actions, true);
    }

    /** After the pick: a short silent confirmation that disappears by itself. */
    static void showDone(Context c, String captureId, String headline, String what) {
        if (!canNotify(c)) return;
        Notification.Builder b = builder(c)
                .setContentTitle("ثبت شد: " + what)
                .setContentText(headline)
                .setContentIntent(openApp(c))
                .setAutoCancel(true)
                .setOnlyAlertOnce(true);
        if (Build.VERSION.SDK_INT >= 26) b.setTimeoutAfter(4000);
        try {
            manager(c).notify(captureId, NOTIFICATION_ID, b.build());
        } catch (SecurityException ignored) {
        }
    }

    static void cancel(Context c, String captureId) {
        if (captureId == null || captureId.isEmpty()) return;
        manager(c).cancel(captureId, NOTIFICATION_ID);
    }

    // ---------------------------------------------------------------- building

    private static void post(Context c, String captureId, String headline, String question, String sms,
                             List<String> labels, List<PendingIntent> actions, boolean quiet) {
        RemoteViews small = new RemoteViews(c.getPackageName(), R.layout.notif_tag_small);
        small.setTextViewText(R.id.notif_title, headline);
        small.setTextViewText(R.id.notif_text, labels.isEmpty() ? question : question + " (بکش پایین)");

        RemoteViews big = chips(c, headline, question, sms, labels, actions);
        RemoteViews headsUp = chips(c, headline, question, null, labels, actions);

        Notification.Builder b = builder(c)
                .setContentTitle(headline)
                .setContentText(question)
                .setContentIntent(openApp(c))
                .setAutoCancel(true)
                .setOnlyAlertOnce(quiet)
                .setCategory(Notification.CATEGORY_MESSAGE)
                .setStyle(new Notification.DecoratedCustomViewStyle())
                .setCustomContentView(small)
                .setCustomBigContentView(big)
                .setCustomHeadsUpContentView(headsUp);
        try {
            manager(c).notify(captureId, NOTIFICATION_ID, b.build());
        } catch (SecurityException ignored) {
        }
    }

    private static RemoteViews chips(Context c, String headline, String question, String sms,
                                     List<String> labels, List<PendingIntent> actions) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.notif_tag);
        v.setTextViewText(R.id.notif_title, headline + " — " + question);
        v.setViewVisibility(R.id.notif_text, sms == null ? View.GONE : View.VISIBLE);
        if (sms != null) v.setTextViewText(R.id.notif_text, sms);
        for (int i = 0; i < CHIPS.length; i++) {
            if (i < labels.size() && i < actions.size()) {
                v.setViewVisibility(CHIPS[i], View.VISIBLE);
                v.setTextViewText(CHIPS[i], labels.get(i));
                v.setOnClickPendingIntent(CHIPS[i], actions.get(i));
            } else {
                // INVISIBLE keeps the row's columns even when it isn't full.
                v.setViewVisibility(CHIPS[i], View.INVISIBLE);
            }
        }
        v.setViewVisibility(R.id.notif_row1, labels.isEmpty() ? View.GONE : View.VISIBLE);
        v.setViewVisibility(R.id.notif_row2, labels.size() > 4 ? View.VISIBLE : View.GONE);
        return v;
    }

    private static Notification.Builder builder(Context c) {
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "تگ‌زدن پیامک بانکی", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("همان لحظه که پیامک بانک می‌آید، تگش را بزن");
            manager(c).createNotificationChannel(ch);
            b = new Notification.Builder(c, CHANNEL);
        } else {
            b = new Notification.Builder(c).setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL);
        }
        return b.setSmallIcon(R.drawable.ic_stat_notify).setShowWhen(true);
    }

    private static PendingIntent action(Context c, String captureId, int slot, String step, String tag, String kind,
                                        String fund, String headline) {
        Intent i = new Intent(c, TagActionReceiver.class)
                // Unique data per button, so each keeps its own extras.
                .setData(Uri.parse("personalcost://tag/" + Uri.encode(captureId) + "/" + step + "/" + slot))
                .putExtra(EXTRA_CAPTURE, captureId)
                .putExtra(EXTRA_TAG, tag)
                .putExtra(EXTRA_KIND, kind)
                .putExtra(EXTRA_FUND, fund)
                .putExtra(EXTRA_STEP, step)
                .putExtra(EXTRA_HEADLINE, headline);
        return PendingIntent.getBroadcast(c, 0, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static PendingIntent openApp(Context c) {
        return PendingIntent.getActivity(
                c, 2,
                new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static NotificationManager manager(Context c) {
        return (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
    }

    private static boolean canNotify(Context c) {
        if (Build.VERSION.SDK_INT >= 33
                && c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return false;
        }
        return manager(c).areNotificationsEnabled();
    }

    private static List<String> strings(JSONArray a) {
        List<String> out = new ArrayList<>();
        if (a == null) return out;
        for (int i = 0; i < a.length(); i++) {
            String s = a.optString(i, "");
            if (!s.isEmpty()) out.add(s);
        }
        return out;
    }

    private static String oneLine(String text) {
        String s = text.replaceAll("\\s+", " ").trim();
        return s.length() > 160 ? s.substring(0, 160) + "…" : s;
    }

    // ---------------------------------------------------------------- a light guess, for display only

    static final class Guess {
        String amount; // «۱۲۰٬۰۰۰ تومان», or null
        String kind; // "expense", "income" or null
    }

    private static final String[] INCOME = {"واریز", "افزایش", "دریافت", "سود", "برگشت", "بستانکار", "انتقال به حساب شما"};
    private static final String[] EXPENSE = {"برداشت", "خرید", "کسر", "پرداخت", "کارمزد", "بدهکار", "انتقال از", "قسط", "شارژ", "مسدود"};
    private static final Pattern BALANCE = Pattern.compile("(مانده|موجودی)\\s*[:：]?\\s*[+-]?\\s*[\\d,]+");
    private static final Pattern NUMBER = Pattern.compile("([+-])?\\s*(\\d{1,3}(?:,\\d{3})+|\\d+)\\s*([+-])?");

    static String normalize(String s) {
        StringBuilder b = new StringBuilder(s.length());
        for (char ch : s.toCharArray()) {
            if (ch >= '۰' && ch <= '۹') ch = (char) ('0' + (ch - '۰'));
            else if (ch >= '٠' && ch <= '٩') ch = (char) ('0' + (ch - '٠'));
            else if (ch == '٬' || ch == '،') ch = ',';
            else if (ch == 'ي' || ch == 'ى') ch = 'ی';
            else if (ch == 'ك') ch = 'ک';
            else if (ch == '‌') ch = ' ';
            else if (ch == '‎' || ch == '‏' || (ch >= '‪' && ch <= '‮')) continue;
            b.append(ch);
        }
        return b.toString();
    }

    static boolean isCode(String text) {
        String n = normalize(text);
        return (n.contains("رمز") || n.contains("کد تایید") || n.contains("کد فعال")) && !n.contains("مبلغ");
    }

    static Guess guess(String text) {
        String n = BALANCE.matcher(normalize(text)).replaceAll(" ");
        Guess g = new Guess();
        Matcher m = NUMBER.matcher(n);
        int bestScore = 1;
        long bestValue = 0;
        boolean bestToman = false;
        String bestSign = null;
        while (m.find()) {
            String raw = m.group(2);
            int start = m.start(2);
            int end = m.end(2);
            String before = n.substring(Math.max(0, start - 14), start);
            String after = n.substring(end, Math.min(n.length(), end + 10));
            if (before.matches("(?s).*\\d\\s*[/:*-]$") || after.matches("(?s)^[/:*]\\s*\\d.*") || after.startsWith("*")) continue;
            String digits = raw.replace(",", "");
            if (!raw.contains(",") && digits.length() > 12) continue;
            long value;
            try {
                value = Long.parseLong(digits);
            } catch (NumberFormatException e) {
                continue;
            }
            if (value == 0) continue;
            int score = 0;
            if (raw.contains(",")) score += 2;
            if (before.matches("(?s).*مبلغ\\s*[:：]?\\s*$")) score += 5;
            boolean toman = after.matches("(?s)^\\s*تومان.*");
            if (after.matches("(?s)^\\s*(ریال|تومان).*")) score += 4;
            String sign = m.group(1) != null ? m.group(1) : m.group(3);
            if (sign != null) score += 3;
            if (!raw.contains(",") && digits.length() < 4 && score < 4) continue;
            if (score > bestScore) {
                bestScore = score;
                bestValue = value;
                bestToman = toman;
                bestSign = sign;
            }
        }
        if (bestValue > 0) {
            long toman = bestToman ? bestValue : Math.round(bestValue / 10.0);
            g.amount = NumberFormat.getIntegerInstance(Locale.forLanguageTag("fa")).format(toman) + " تومان";
        }
        if ("+".equals(bestSign)) g.kind = "income";
        else if ("-".equals(bestSign)) g.kind = "expense";
        else {
            boolean inc = containsAny(n, INCOME);
            boolean exp = containsAny(n, EXPENSE);
            if (inc && !exp) g.kind = "income";
            else if (exp && !inc) g.kind = "expense";
        }
        return g;
    }

    private static boolean containsAny(String s, String[] words) {
        for (String w : words) if (s.contains(w)) return true;
        return false;
    }
}
