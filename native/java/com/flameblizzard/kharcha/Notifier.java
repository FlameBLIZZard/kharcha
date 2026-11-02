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
    static final String[] NAMES = {"food", "shopping", "petrol", "subscriptions", "groceries", "travel", "bills", "other"};
    static final String[] LABELS = {"Food", "Shopping", "Petrol", "Subscriptions", "Groceries", "Travel", "Bills", "Other"};

    static String label(Context c, String cat) {
        for (String[] x : Store.cats(c)) if (x[0].equals(cat)) return x[1];
        return "Other";
    }

    static void show(Context c, double amt, String merchant, String cat) {
        try {
            int id = (int) (System.currentTimeMillis() / 1000);
            String amtStr = (amt == Math.floor(amt)) ? String.valueOf((long) amt) : String.format(java.util.Locale.US, "%.2f", amt);
            boolean overlay = Overlay.show(c.getApplicationContext(), id, amtStr, merchant, cat);
            render(c, id, amtStr, merchant, cat, 0, overlay);
        } catch (Exception ignored) { }
    }

    /** Page 0: Save (guessed category) / Note... / More.  Later pages: two more categories each / More (loops back). */
    static void render(Context c, int id, String amtStr, String merchant, String guess, int page) {
        render(c, id, amtStr, merchant, guess, page, false);
    }

    /** quiet = the floating card is already on screen, so keep this notification silent as a backup. */
    static void render(Context c, int id, String amtStr, String merchant, String guess, int page, boolean quiet) {
        try {
            if (Build.VERSION.SDK_INT >= 26) {
                NotificationChannel ch = new NotificationChannel(CHANNEL, "New expense", NotificationManager.IMPORTANCE_HIGH);
                ch.setDescription("Pops up when a payment is detected");
                c.getSystemService(NotificationManager.class).createNotificationChannel(ch);
                NotificationChannel qc = new NotificationChannel("kharcha_tx_quiet", "New expense (quiet backup)", NotificationManager.IMPORTANCE_LOW);
                qc.setDescription("Silent copy of the popup, in case you dismissed it");
                c.getSystemService(NotificationManager.class).createNotificationChannel(qc);
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

            NotificationCompat.Builder b = new NotificationCompat.Builder(c, quiet ? "kharcha_tx_quiet" : CHANNEL)
                .setSmallIcon(android.R.drawable.ic_menu_edit)
                .setContentTitle("\u20b9" + amtStr + (merchant.isEmpty() ? " spent" : " \u00b7 " + merchant))
                .setContentText(page == 0
                    ? (guess.isEmpty() ? "Pick a category, or tap to open" : "Looks like " + label(c, best) + ". Save, add a note, or tap for more")
                    : "Save under\u2026")
                .setPriority(quiet ? NotificationCompat.PRIORITY_LOW : NotificationCompat.PRIORITY_HIGH)
                .setDefaults(quiet ? 0 : NotificationCompat.DEFAULT_ALL)
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

    /**
     * Always-there entry in the notification shade. Pull down, type "120 chai", send: the category popup appears.
     * Nothing is read from other apps, so BHIM has nothing to object to.
     */
    static void showQuickAdd(Context c) {
        try {
            if (Build.VERSION.SDK_INT >= 26) {
                NotificationManager nmgr = c.getSystemService(NotificationManager.class);
                nmgr.deleteNotificationChannel("kharcha_quick");   // old LOW channel: Samsung filed it under "Silent"
                NotificationChannel ch = new NotificationChannel("kharcha_quick2", "Quick add", NotificationManager.IMPORTANCE_DEFAULT);
                ch.setDescription("A permanent shortcut to add an expense");
                ch.setSound(null, null);
                ch.enableVibration(false);
                ch.setShowBadge(false);
                nmgr.createNotificationChannel(ch);
            }
            Intent open = new Intent(c, MainActivity.class).setAction(Intent.ACTION_VIEW).setData(Uri.parse("kharcha://add"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent tap = PendingIntent.getActivity(c, 7, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            androidx.core.app.RemoteInput ri = new androidx.core.app.RemoteInput.Builder("amt").setLabel("Amount and what for, e.g. 120 chai").build();
            Intent quick = new Intent(c, ActionReceiver.class).setAction("com.flameblizzard.kharcha.quick").putExtra("what", "quick");
            PendingIntent quickPi = PendingIntent.getBroadcast(c, 8, quick,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0));
            Intent gone = new Intent(c, ActionReceiver.class).setAction("com.flameblizzard.kharcha.requick").putExtra("what", "requick");
            PendingIntent gonePi = PendingIntent.getBroadcast(c, 9, gone, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            NotificationCompat.Builder b = new NotificationCompat.Builder(c, "kharcha_quick2")
                .setSmallIcon(android.R.drawable.ic_menu_add)
                .setContentTitle("Kharcha")
                .setContentText("Just paid? Type the amount")
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setDefaults(0)
                .setOnlyAlertOnce(true)
                .setDeleteIntent(gonePi)
                .setOngoing(true)
                .setShowWhen(false)
                .setContentIntent(tap)
                .addAction(new NotificationCompat.Action.Builder(0, "\u20b9 Add", quickPi).addRemoteInput(ri).setAllowGeneratedReplies(false).build());
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
