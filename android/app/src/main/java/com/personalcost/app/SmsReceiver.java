package com.personalcost.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;

import java.util.LinkedHashMap;
import java.util.Map;

/** Queues SMS from the bank sender numbers configured in the app. */
public class SmsReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;
        SmsMessage[] messages = Telephony.Sms.Intents.getMessagesFromIntent(intent);
        if (messages == null) return;

        // Long SMS arrive as several PDUs; join the parts per sender.
        Map<String, StringBuilder> bySender = new LinkedHashMap<>();
        for (SmsMessage m : messages) {
            String sender = m.getOriginatingAddress() != null ? m.getOriginatingAddress() : m.getDisplayOriginatingAddress();
            if (sender == null) sender = "";
            StringBuilder b = bySender.get(sender);
            if (b == null) bySender.put(sender, b = new StringBuilder());
            if (m.getMessageBody() != null) b.append(m.getMessageBody());
        }

        long now = System.currentTimeMillis();
        for (Map.Entry<String, StringBuilder> e : bySender.entrySet()) {
            if (CaptureStore.matchesSender(context, e.getKey())) {
                CaptureStore.enqueue(context, e.getKey(), e.getValue().toString(), now);
            }
        }
    }
}
