package com.personalcost.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import org.json.JSONArray;

/** A tag button on the SMS notification (TagNotifier) was tapped. */
public class TagActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String captureId = intent.getStringExtra(TagNotifier.EXTRA_CAPTURE);
        String tag = intent.getStringExtra(TagNotifier.EXTRA_TAG);
        String kind = intent.getStringExtra(TagNotifier.EXTRA_KIND);
        String fund = intent.getStringExtra(TagNotifier.EXTRA_FUND);
        String step = intent.getStringExtra(TagNotifier.EXTRA_STEP);
        String headline = intent.getStringExtra(TagNotifier.EXTRA_HEADLINE);
        if (captureId == null || tag == null || kind == null) return;
        if (headline == null) headline = "";

        // An expense tag: ask which «پول» paid for it, if there's any to choose from.
        if (TagNotifier.STEP_TAG.equals(step) && "expense".equals(kind)) {
            JSONArray funds = CaptureStore.tagOptions(context).optJSONArray("payFrom");
            if (funds != null && funds.length() > 0) {
                TagNotifier.showFunds(context, captureId, tag, headline);
                return;
            }
        }

        CaptureStore.addTagChoice(context, captureId, tag, kind, TagNotifier.STEP_FUND.equals(step) ? fund : null);
        TagNotifier.showDone(context, captureId, headline, fund != null ? tag + " · از " + fund : tag);
        PersonalCostPlugin.notifyTagChoice();
    }
}
