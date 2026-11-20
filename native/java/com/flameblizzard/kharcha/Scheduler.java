package com.flameblizzard.kharcha;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import java.util.Calendar;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Bill reminders and weekly / monthly recaps. Two inexact daily alarms (9:00 and 20:00, no exact-alarm permission needed);
 * the web app pushes the bill list and the recap numbers whenever it opens.
 */
final class Scheduler {
    static final String BILLS = "kharcha_bills", RECAP = "kharcha_recap";

    static SharedPreferences sp(Context c) { return c.getSharedPreferences("kharcha_sched", Context.MODE_PRIVATE); }

    static void save(Context c, String json) { sp(c).edit().putString("cfg", json).apply(); schedule(c); }

    static void schedule(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        at(c, am, 9, "morning", 101);
        at(c, am, 20, "evening", 102);
        at(c, am, 0, "midnight", 103);   // rolls the widgets over to a new day
    }

    private static void at(Context c, AlarmManager am, int hour, String kind, int code) {
        Calendar k = Calendar.getInstance();
        k.set(Calendar.HOUR_OF_DAY, hour); k.set(Calendar.MINUTE, 0); k.set(Calendar.SECOND, 0); k.set(Calendar.MILLISECOND, 0);
        if (k.getTimeInMillis() <= System.currentTimeMillis()) k.add(Calendar.DAY_OF_MONTH, 1);
        Intent i = new Intent(c, ReminderReceiver.class).setAction("com.flameblizzard.kharcha.tick." + kind).putExtra("kind", kind);
        PendingIntent pi = PendingIntent.getBroadcast(c, code, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        am.setInexactRepeating(AlarmManager.RTC_WAKEUP, k.getTimeInMillis(), AlarmManager.INTERVAL_DAY, pi);
    }

    private static JSONObject cfg(Context c) {
        try { return new JSONObject(sp(c).getString("cfg", "{}")); } catch (Exception e) { return new JSONObject(); }
    }

    private static boolean on(JSONObject cfg, String k) {
        JSONObject e = cfg.optJSONObject("enabled");
        return e == null || e.optBoolean(k, true);
    }

    static String money(String cur, double v) {
        long r = Math.round(Math.abs(v));
        // Indian grouping: 1,23,456
        String s = String.valueOf(r);
        if (s.length() > 3) {
            String head = s.substring(0, s.length() - 3), tail = s.substring(s.length() - 3);
            StringBuilder b = new StringBuilder();
            for (int i = 0; i < head.length(); i++) { if (i > 0 && (head.length() - i) % 2 == 0) b.append(','); b.append(head.charAt(i)); }
            s = b + "," + tail;
        }
        return cur + s;
    }

    static String ym(Calendar k) { return String.format(Locale.US, "%04d-%02d", k.get(Calendar.YEAR), k.get(Calendar.MONTH) + 1); }

    /** Runs the checks for one alarm. force = ignore the "already sent" keys and the day/time rules (for the Setup preview). */
    static void tick(Context c, String kind, boolean force) {
        BaseWidget.refreshAll(c);
        if ("midnight".equals(kind)) return;
        JSONObject cfg = cfg(c);
        Calendar now = Calendar.getInstance();
        if (force || "morning".equals(kind)) {
            if (on(cfg, "bills")) bills(c, cfg, now, force);
            if (on(cfg, "monthly")) monthly(c, cfg, now, force);
        }
        if (force || "evening".equals(kind)) {
            if (on(cfg, "weekly")) weekly(c, cfg, now, force);
        }
    }

    private static void bills(Context c, JSONObject cfg, Calendar now, boolean force) {
        JSONArray a = cfg.optJSONArray("bills");
        if (a == null) return;
        String cur = recapOf(cfg).optString("currency", "₹");
        SharedPreferences p = sp(c);
        for (int i = 0; i < a.length(); i++) {
            JSONObject b = a.optJSONObject(i);
            if (b == null) continue;
            int day = b.optInt("day", 0);
            double amt = b.optDouble("amt", 0);
            if (day < 1 || amt <= 0) continue;
            Calendar due = dueOnOrAfter(now, day);
            int left = daysBetween(now, due);
            if (left < 0 || left > 2) continue;
            String id = b.optString("id"), month = ym(due), key = "bn-" + id + "-" + month + (left == 0 ? "-d" : "-e");
            if (!force && (p.getBoolean(key, false) || p.getBoolean("paid-" + id + "-" + month, false))) continue;
            p.edit().putBoolean(key, true).apply();
            String name = b.optString("name", "Bill");
            String when = left == 0 ? "due today" : left == 1 ? "due tomorrow" : "due in 2 days";
            int nid = ("bill" + id + month).hashCode();
            Intent paid = new Intent(c, ReminderReceiver.class).setAction("com.flameblizzard.kharcha.paid." + id + month)
                .putExtra("kind", "paid").putExtra("id", id).putExtra("month", month).putExtra("name", name)
                .putExtra("amt", amt).putExtra("cat", b.optString("cat", "bills")).putExtra("nid", nid);
            PendingIntent paidPi = PendingIntent.getBroadcast(c, nid, paid, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            post(c, BILLS, nid, name + " " + when, money(cur, amt) + (left == 0 ? " · tap Mark paid once it's done" : " on the " + day + suffix(day)),
                new NotificationCompat.Action(0, "Mark paid", paidPi));
        }
    }

    private static JSONObject recapOf(JSONObject cfg) { JSONObject r = cfg.optJSONObject("recap"); return r == null ? new JSONObject() : r; }

    private static String asOfNote(JSONObject r, long maxAgeDays) {
        long asOf = r.optLong("asOf", 0);
        if (asOf <= 0 || System.currentTimeMillis() - asOf < maxAgeDays * 86400000L) return "";
        Calendar k = Calendar.getInstance(); k.setTimeInMillis(asOf);
        return " (numbers from " + k.get(Calendar.DAY_OF_MONTH) + " " + k.getDisplayName(Calendar.MONTH, Calendar.SHORT, Locale.ENGLISH) + ")";
    }

    private static void weekly(Context c, JSONObject cfg, Calendar now, boolean force) {
        int dow = now.get(Calendar.DAY_OF_WEEK);
        boolean window = (dow == Calendar.SUNDAY && now.get(Calendar.HOUR_OF_DAY) >= 18) || dow == Calendar.MONDAY;
        Calendar sun = (Calendar) now.clone();
        while (sun.get(Calendar.DAY_OF_WEEK) != Calendar.SUNDAY) sun.add(Calendar.DAY_OF_MONTH, -1);
        String key = "wk-" + sun.get(Calendar.YEAR) + "-" + sun.get(Calendar.DAY_OF_YEAR);
        if (!force && (!window || sp(c).getBoolean(key, false))) return;
        JSONObject r = recapOf(cfg);
        if (!r.has("weekSpent")) return;
        sp(c).edit().putBoolean(key, true).apply();
        String cur = r.optString("currency", "₹");
        double w = r.optDouble("weekSpent", 0), pw = r.optDouble("prevWeekSpent", 0);
        String cmp = pw > 0 ? (w <= pw ? ", " + Math.round((pw - w) / pw * 100) + "% less than the week before" : ", " + Math.round((w - pw) / pw * 100) + "% more than the week before") : "";
        String top = r.optString("topCategory", "");
        post(c, RECAP, 9101, "Your week: " + money(cur, w), "Spent " + money(cur, w) + cmp + (top.isEmpty() ? "" : ". Biggest: " + top) + "." + asOfNote(r, 3), null);
    }

    private static void monthly(Context c, JSONObject cfg, Calendar now, boolean force) {
        JSONObject r = recapOf(cfg);
        int start = Math.max(1, Math.min(28, r.optInt("startDay", 1)));
        if (!force && now.get(Calendar.DAY_OF_MONTH) != start && now.get(Calendar.DAY_OF_MONTH) != start + 1) return;
        String key = "mo-" + ym(now);
        if (!force && sp(c).getBoolean(key, false)) return;
        if (!r.has("monthSpent")) return;
        sp(c).edit().putBoolean(key, true).apply();
        String cur = r.optString("currency", "₹");
        // If the app was opened after the new month began, the finished month is in prevMonthSpent.
        long asOf = r.optLong("asOf", 0);
        Calendar a = Calendar.getInstance(); a.setTimeInMillis(asOf > 0 ? asOf : System.currentTimeMillis());
        boolean openedThisMonth = asOf > 0 && daysBetween(a, now) <= 1 && a.get(Calendar.DAY_OF_MONTH) >= start && a.get(Calendar.MONTH) == now.get(Calendar.MONTH);
        double m = openedThisMonth ? r.optDouble("prevMonthSpent", 0) : r.optDouble("monthSpent", 0);
        double pm = openedThisMonth ? 0 : r.optDouble("prevMonthSpent", 0);
        String cmp = pm > 0 ? (m <= pm ? ", " + money(cur, pm - m) + " less than the month before" : ", " + money(cur, m - pm) + " more than the month before") : "";
        double saved = openedThisMonth ? 0 : r.optDouble("savedThisMonth", 0), skipped = openedThisMonth ? 0 : r.optDouble("skippedThisMonth", 0);
        String extra = (saved > 0 ? " Saved " + money(cur, saved) + "." : "") + (skipped > 0 ? " Skipped " + money(cur, skipped) + " of buys." : "");
        post(c, RECAP, 9102, "Last month: " + money(cur, m), "You spent " + money(cur, m) + cmp + "." + extra + " Open Kharcha for the full report.", null);
    }

    static Calendar dueOnOrAfter(Calendar now, int day) {
        Calendar d = (Calendar) now.clone();
        for (int add = 0; add < 2; add++) {
            Calendar k = (Calendar) now.clone();
            k.set(Calendar.DAY_OF_MONTH, 1);
            k.add(Calendar.MONTH, add);
            k.set(Calendar.DAY_OF_MONTH, Math.min(day, k.getActualMaximum(Calendar.DAY_OF_MONTH)));
            if (daysBetween(now, k) >= 0) return k;
            d = k;
        }
        return d;
    }

    static int daysBetween(Calendar a, Calendar b) {
        Calendar x = (Calendar) a.clone(), y = (Calendar) b.clone();
        for (Calendar k : new Calendar[]{x, y}) { k.set(Calendar.HOUR_OF_DAY, 12); k.set(Calendar.MINUTE, 0); k.set(Calendar.SECOND, 0); k.set(Calendar.MILLISECOND, 0); }
        return (int) Math.round((y.getTimeInMillis() - x.getTimeInMillis()) / 86400000.0);
    }

    private static String suffix(int d) { return (d % 10 > 3 || d % 10 == 0 || (d >= 11 && d <= 13)) ? "th" : new String[]{"", "st", "nd", "rd"}[d % 10]; }

    static void post(Context c, String channel, int id, String title, String text, NotificationCompat.Action action) {
        try {
            if (Build.VERSION.SDK_INT >= 26) {
                NotificationManager nm = c.getSystemService(NotificationManager.class);
                NotificationChannel b = new NotificationChannel(BILLS, "Bill reminders", NotificationManager.IMPORTANCE_HIGH);
                b.setDescription("A day or two before rent, EMIs and other bills are due");
                nm.createNotificationChannel(b);
                NotificationChannel r = new NotificationChannel(RECAP, "Weekly and monthly recap", NotificationManager.IMPORTANCE_DEFAULT);
                r.setDescription("Sunday evening and start-of-month summaries");
                nm.createNotificationChannel(r);
            }
            Intent open = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            NotificationCompat.Builder n = new NotificationCompat.Builder(c, channel)
                .setSmallIcon(android.R.drawable.ic_menu_agenda)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
                .setAutoCancel(true)
                .setContentIntent(PendingIntent.getActivity(c, id, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
            if (action != null) n.addAction(action);
            NotificationManagerCompat m = NotificationManagerCompat.from(c);
            if (m.areNotificationsEnabled()) m.notify(id, n.build());
        } catch (SecurityException ignored) { }
    }
}
