package com.personalcost.app.listener

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.personalcost.app.data.DebugLog
import com.personalcost.app.ingest.TransactionIngestor
import com.personalcost.app.parsing.ParserEngine

class BankNotificationListenerService : NotificationListenerService() {

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (sbn.packageName == packageName) return
        val n = sbn.notification ?: return
        // Group summaries repeat their children's content; skip to avoid double-processing.
        if (n.flags and Notification.FLAG_GROUP_SUMMARY != 0) return

        val text = extractText(n)

        if (DebugLog.captureAll) DebugLog.log("NOTIF", sbn.packageName, text)

        TransactionIngestor.ingest(this, ParserEngine.Source.NOTIFICATION, sbn.packageName, text, sbn.postTime)
    }

    /**
     * Bank apps format notifications differently: some use EXTRA_TEXT, some BigTextStyle, some
     * InboxStyle lines, and some put the amount in the title. Combine them all.
     */
    private fun extractText(n: Notification): String {
        val e = n.extras ?: return ""
        val title = e.getCharSequence(Notification.EXTRA_TITLE)?.toString()
        val bigText = e.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
        val text = e.getCharSequence(Notification.EXTRA_TEXT)?.toString()
        val lines = e.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)?.joinToString("\n")
        val body = bigText?.takeIf { it.isNotBlank() } ?: text
        return listOfNotNull(title, body, lines)
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .distinct()
            .joinToString("\n")
    }
}
