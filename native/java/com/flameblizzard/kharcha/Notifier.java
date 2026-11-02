package com.flameblizzard.kharcha;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import java.net.URLEncoder;

/** The quick popup: a heads-up notification with one-tap save buttons. Tapping it opens the full quick-add sheet. */
final class Notifier {
    static final String CHANNEL = "kharcha_tx";
    static final String[] NAMES = {"food", "groceries", "travel", "shopping", "bills", "fun", "health", "other"};
    static final String[] LABELS = {"Food", "Groceries", "Travel", "Shopping", "Bills", "Fun", "Health", "Other"};

    static String label(String cat) {
        for (int i = 0; i < NAMES.length; i++) if (NAMES[i].equals(cat)) return LABELS[i];
        return "Other";
    }

    static void show(Context c, double amt, String merchant, String cat) {
        try {
            if (Build.VERSION.SDK_INT >= 26) {
                NotificationChannel ch = new NotificationChannel(CHANNEL, "New expense", NotificationManager.IMPORTANCE_HIGH);
                ch.setDescription("Pops up when a payment is detected");
                c.getSystemService(NotificationManager.class).createNotificationChannel(ch);
            }
            int id = (int) (System.currentTimeMillis() / 1000);
            String amtStr = (amt == Math.floor(amt)) ? String.valueOf((long) amt) : String.format(java.util.Locale.US, "%.2f", amt);
            String uri = "kharcha://add?amount=" + amtStr + "&merchant=" + URLEncoder.encode(merchant, "UTF-8") + "&cat=" + cat;
            Intent open = new Intent(c, MainActivity.class).setAction(Intent.ACTION_VIEW).setData(Uri.parse(uri))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            int fl = PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT;
            PendingIntent tap = PendingIntent.getActivity(c, id, open, fl);

            String best = cat.isEmpty() ? "food" : cat;
            NotificationCompat.Builder b = new NotificationCompat.Builder(c, CHANNEL)
                .setSmallIcon(android.R.drawable.ic_menu_edit)
                .setContentTitle("₹" + amtStr + (merchant.isEmpty() ? " spent" : " · " + merchant))
                .setContentText(cat.isEmpty() ? "Tap to pick a category and add a note" : "Looks like " + label(cat) + ". Tap to change or add a note")
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setAutoCancel(true)
                .setContentIntent(tap)
                .setTimeoutAfter(6 * 60 * 60 * 1000L);
            b.addAction(0, "Save · " + label(best), action(c, id, amtStr, merchant, best, "save"));
            if (!best.equals("other")) b.addAction(0, "Other", action(c, id, amtStr, merchant, "other", "save"));
            b.addAction(0, "Not mine", action(c, id, amtStr, merchant, "", "dismiss"));
            NotificationManagerCompat nm = NotificationManagerCompat.from(c);
            if (nm.areNotificationsEnabled()) nm.notify(id, b.build());
        } catch (SecurityException | java.io.UnsupportedEncodingException ignored) { }
    }

    /** Always-there "Add expense" entry in the notification shade. Shown whenever the listener connects (also after reboot). */
    static void showQuickAdd(Context c) {
        try {
            if (Build.VERSION.SDK_INT >= 26) {
                NotificationChannel ch = new NotificationChannel("kharcha_quick", "Quick add", NotificationManager.IMPORTANCE_LOW);
                ch.setDescription("A permanent shortcut to add an expense");
                c.getSystemService(NotificationManager.class).createNotificationChannel(ch);
            }
            Intent open = new Intent(c, MainActivity.class).setAction(Intent.ACTION_VIEW).setData(Uri.parse("kharcha://add"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent tap = PendingIntent.getActivity(c, 7, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            NotificationCompat.Builder b = new NotificationCompat.Builder(c, "kharcha_quick")
                .setSmallIcon(android.R.drawable.ic_menu_add)
                .setContentTitle("Kharcha")
                .setContentText("Tap to add an expense")
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .setShowWhen(false)
                .setContentIntent(tap);
            NotificationManagerCompat nm = NotificationManagerCompat.from(c);
            if (nm.areNotificationsEnabled()) nm.notify(7, b.build());
        } catch (SecurityException ignored) { }
    }

    private static PendingIntent action(Context c, int id, String amt, String merchant, String cat, String what) {
        Intent i = new Intent(c, ActionReceiver.class).setAction("com.flameblizzard.kharcha." + what + id + cat)
            .putExtra("id", id).putExtra("amt", amt).putExtra("merchant", merchant).putExtra("cat", cat).putExtra("what", what);
        return PendingIntent.getBroadcast(c, (id + cat + what).hashCode(), i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
}
