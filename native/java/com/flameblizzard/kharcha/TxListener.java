package com.flameblizzard.kharcha;

import android.app.Notification;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

/** Watches other apps' notifications (needs the Notification access switch) and reacts to payments. */
public class TxListener extends NotificationListenerService {
    @Override
    public void onListenerConnected() { Notifier.showQuickAdd(getApplicationContext()); }

    /** "Clear all" can remove even pinned notifications on Android 14, so put the quick-add one straight back. */
    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        try {
            if (sbn != null && getPackageName().equals(sbn.getPackageName()) && sbn.getId() == 7) {
                final android.content.Context app = getApplicationContext();
                new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
                    @Override public void run() { Notifier.showQuickAdd(app); }
                }, 800);
            }
        } catch (Exception ignored) { }
    }

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
