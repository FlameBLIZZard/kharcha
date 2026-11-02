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

    static String label(Context c, String cat) {
        for (String[] x : Store.cats(c)) if (x[0].equals(cat)) return x[1];
        return "Other";
    }

    static void show(Context c, double amt, String merchant, String cat) {
        try {
            int id = (int) (System.currentTimeMillis() / 1000);
            String amtStr = (amt == Math.floor(amt)) ? String.valueOf((long) amt) : String.format(java.util.Locale.US, "%.2f", amt);
            render(c, id, amtStr, merchant, cat, 0);
        } catch (Exception ignored) { }
    }

    /** Page 0: Save (guessed category) / Note... / More.  Later pages: two more categories each / More (loops back). */
    static void render(Context c, int id, String amtStr, String merchant, String guess, int page) {
        try {
            if (Build.VERSION.SDK_INT >= 26) {
                NotificationChannel ch = new NotificationChannel(CHANNEL, "New expense", NotificationManager.IMPORTANCE_HIGH);
                ch.setDescription("Pops up when a payment is detected");
                c.getSystemService(NotificationManager.class).createNotificationChannel(ch);
            }
            java.util.List<String[]> all = Store.cats(c);
            String best = guess;
            boolean known = false;
            for (String[] x : all) if (x[0].equals(best)) known = true;
            if (!known) best = all.get(0)[0];
            java.util.List<String[]> others = new java.util.ArrayList<>();
            for (String[] x : all) if (!x[0].equals(best)) others.add(x);
            int pages = 1 + (others.size() + 1) / 2;
            page = page % pages;

            String uri = "kharcha://add?amount=" + amtStr + "&merchant=" + URLEncoder.encode(merchant, "UTF-8") + "&cat=" + best;
            Intent open = new Intent(c, MainActivity.class).setAction(Intent.ACTION_VIEW).setData(Uri.parse(uri))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent tap = PendingIntent.getActivity(c, id, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

            NotificationCompat.Builder b = new NotificationCompat.Builder(c, CHANNEL)
                .setSmallIcon(android.R.drawable.ic_menu_edit)
                .setContentTitle("\u20b9" + amtStr + (merchant.isEmpty() ? " spent" : " \u00b7 " + merchant))
                .setContentText(page == 0
                    ? (guess.isEmpty() ? "Pick a category, or tap to open" : "Looks like " + label(c, best) + ". Save, add a note, or tap for more")
                    : "Save under\u2026")
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setOnlyAlertOnce(true)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setAutoCancel(true)
                .setContentIntent(tap)
                .setTimeoutAfter(6 * 60 * 60 * 1000L);

            if (page == 0) {
                b.addAction(0, "Save \u00b7 " + label(c, best), action(c, id, amtStr, merchant, guess, best, "save", page, null));
                androidx.core.app.RemoteInput ri = new androidx.core.app.RemoteInput.Builder("note").setLabel("Add a note").build();
                int fl = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
                PendingIntent notePi = action(c, id, amtStr, merchant, guess, best, "note", page, fl);
                b.addAction(new NotificationCompat.Action.Builder(0, "\u270e Note", notePi).addRemoteInput(ri).setAllowGeneratedReplies(false).build());
            } else {
                for (int k = 0; k < 2; k++) {
                    int idx = (page - 1) * 2 + k;
                    if (idx < others.size()) b.addAction(0, others.get(idx)[1], action(c, id, amtStr, merchant, guess, others.get(idx)[0], "save", page, null));
                }
            }
            if (pages > 1) b.addAction(0, page == pages - 1 ? "\u2039 Back" : "More \u203a", action(c, id, amtStr, merchant, guess, best, "more", page + 1, null));
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

    private static PendingIntent action(Context c, int id, String amt, String merchant, String guess, String cat, String what, int page, Integer flags) {
        Intent i = new Intent(c, ActionReceiver.class).setAction("com.flameblizzard.kharcha." + what + id + cat + page)
            .putExtra("id", id).putExtra("amt", amt).putExtra("merchant", merchant).putExtra("guess", guess)
            .putExtra("cat", cat).putExtra("what", what).putExtra("page", page);
        int fl = flags != null ? flags : (PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return PendingIntent.getBroadcast(c, (id + what + cat + page).hashCode(), i, fl);
    }
}
