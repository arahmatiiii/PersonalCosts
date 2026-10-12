package com.personalcost.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.util.Locale;

/**
 * Home-screen widget: this month's spending, today's, what's left in the «پول»s and how many
 * transactions wait for a tag. The JS side formats the texts (Persian digits, Toman) and pushes them
 * through PersonalCostPlugin.setWidget; SMS queued since then are added to the waiting count here.
 */
public class SpendWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, views(context));
    }

    static void refresh(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, SpendWidget.class));
        if (ids.length > 0) manager.updateAppWidget(ids, views(context));
    }

    private static RemoteViews views(Context context) {
        JSONObject d = CaptureStore.widget(context);
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_spend);
        v.setTextViewText(R.id.widget_title, d.optString("title", "خرج این ماه"));
        v.setTextViewText(R.id.widget_month, d.optString("month", "—"));
        v.setTextViewText(R.id.widget_today, d.optString("today", "—"));

        String funds = d.optString("funds", "");
        v.setViewVisibility(R.id.widget_funds_box, funds.isEmpty() ? View.GONE : View.VISIBLE);
        v.setTextViewText(R.id.widget_funds, funds);

        int waiting = d.optInt("untagged", 0) + CaptureStore.pending(context);
        v.setViewVisibility(R.id.widget_untagged, waiting > 0 ? View.VISIBLE : View.GONE);
        v.setTextViewText(R.id.widget_untagged, String.format(Locale.forLanguageTag("fa"), "%d تراکنش منتظر تگ", waiting));

        PendingIntent open = PendingIntent.getActivity(
                context, 1,
                new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        v.setOnClickPendingIntent(R.id.widget_root, open);
        return v;
    }
}
