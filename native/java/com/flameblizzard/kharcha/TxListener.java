package com.flameblizzard.kharcha;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

/** Watches other apps' notifications (needs the Notification access switch) and reacts to payments. */
public class TxListener extends NotificationListenerService {
    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            if (sbn == null || getPackageName().equals(sbn.getPackageName())) return;
            Notification n = sbn.getNotification();
            if (n == null || n.extras == null) return;
            Bundle e = n.extras;
            StringBuilder b = new StringBuilder();
            for (String k : new String[]{Notification.EXTRA_TITLE, Notification.EXTRA_TEXT, Notification.EXTRA_BIG_TEXT}) {
                CharSequence v = e.getCharSequence(k);
                if (v != null) b.append(v).append(' ');
            }
            Detector.handle(getApplicationContext(), b.toString(), false);
        } catch (Exception ignored) { }
    }
}
