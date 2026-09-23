package com.personalcost.app.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import com.personalcost.app.data.DebugLog
import com.personalcost.app.ingest.TransactionIngestor
import com.personalcost.app.parsing.ParserEngine

class SmsReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return

        // Long SMS arrive as several PDUs; join the parts per sender before parsing.
        messages
            .groupBy { it.originatingAddress ?: it.displayOriginatingAddress ?: "" }
            .forEach { (sender, parts) ->
                val body = parts.joinToString("") { it.messageBody ?: "" }
                if (DebugLog.captureAll) DebugLog.log("SMS", sender, body)
                TransactionIngestor.ingest(context, ParserEngine.Source.SMS, sender, body, System.currentTimeMillis())
            }
    }
}
