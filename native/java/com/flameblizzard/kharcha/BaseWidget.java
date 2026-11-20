package com.flameblizzard.kharcha;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.widget.RemoteViews;
import java.util.Calendar;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Shared plumbing for every Kharcha home-screen widget. The web app pushes one stats object (KN.setWidget);
 * each widget renders its slice of it. Between app opens the numbers are rolled forward here: a new day resets
 * "today", and expenses saved from notifications are added on top.
 */
abstract class BaseWidget extends AppWidgetProvider {
    @SuppressWarnings("unchecked")
    static final Class<? extends BaseWidget>[] ALL = new Class[]{
        KharchaWidget.class, BudgetWidget.class, WeekWidget.class, GoalWidget.class,
        QuickWidget.class, QuickBarWidget.class, BillWidget.class, PulseWidget.class };

    abstract RemoteViews build(Context c, Bundle opts);

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) render(c, m, id);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle o) { render(c, m, id); }

    private void render(Context c, AppWidgetManager m, int id) {
        try { m.updateAppWidget(id, build(c, m.getAppWidgetOptions(id))); } catch (Exception ignored) { }
    }

    /** Re-renders every placed Kharcha widget. */
    static void refreshAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        for (Class<? extends BaseWidget> k : ALL) {
            try {
                int[] ids = m.getAppWidgetIds(new ComponentName(c, k));
                if (ids == null || ids.length == 0) continue;
                BaseWidget w = k.newInstance();
                for (int id : ids) w.render(c, m, id);
            } catch (Exception ignored) { }
        }
    }

    static SharedPreferences sp(Context c) { return c.getSharedPreferences("kharcha_widget", Context.MODE_PRIVATE); }

    static String dayKey(Calendar k) { return k.get(Calendar.YEAR) + "-" + (k.get(Calendar.MONTH) + 1) + "-" + k.get(Calendar.DAY_OF_MONTH); }
    static String today() { return dayKey(Calendar.getInstance()); }

    /** The pushed stats, rolled forward to today. Adds "stale" = true when the app has not been opened today. */
    static JSONObject stats(Context c) {
        SharedPreferences p = sp(c);
        JSONObject s;
        try { s = new JSONObject(p.getString("stats", "{}")); } catch (Exception e) { s = new JSONObject(); }
        try {
            long setAt = p.getLong("setAt", 0);
            int elapsed = 0;
            if (setAt > 0) { Calendar a = Calendar.getInstance(); a.setTimeInMillis(setAt); elapsed = Math.max(0, Scheduler.daysBetween(a, Calendar.getInstance())); }
            if (elapsed > 0) {
                s.put("stale", true);
                s.put("todaySpent", 0);
                s.put("safeToday", JSONObject.NULL);
                if (s.has("daysLeft")) s.put("daysLeft", Math.max(1, s.optInt("daysLeft", 1) - elapsed));
                JSONObject bill = s.optJSONObject("bill");
                if (bill != null) { int left = bill.optInt("left", 0) - elapsed; if (left < 0) s.put("bill", JSONObject.NULL); else bill.put("left", left); }
                JSONArray w = s.optJSONArray("week");
                if (w != null) {
                    JSONArray n = new JSONArray();
                    for (int i = Math.min(elapsed, w.length()); i < w.length(); i++) n.put(w.get(i));
                    for (int k = Math.min(elapsed, 7) - 1; k >= 0; k--) {
                        Calendar d = Calendar.getInstance(); d.add(Calendar.DAY_OF_MONTH, -k);
                        n.put(new JSONObject().put("d", String.valueOf("SMTWTFS".charAt(d.get(Calendar.DAY_OF_WEEK) - 1))).put("v", 0));
                    }
                    s.put("week", n);
                }
            }
            double since = p.getFloat("since", 0f);
            double sinceT = today().equals(p.getString("sinceDay", "")) ? p.getFloat("sinceT", 0f) : 0;
            if (since > 0) {
                if (sinceT > 0) {
                    s.put("todaySpent", s.optDouble("todaySpent", 0) + sinceT);
                    JSONArray w = s.optJSONArray("week");
                    if (w != null && w.length() > 0) { JSONObject last = w.getJSONObject(w.length() - 1); last.put("v", last.optDouble("v", 0) + sinceT); }
                    if (has(s, "safeToday")) s.put("safeToday", s.optDouble("safeToday", 0) - sinceT);
                }
                s.put("monthSpent", s.optDouble("monthSpent", 0) + since);
                if (has(s, "budgetLeft")) s.put("budgetLeft", s.optDouble("budgetLeft", 0) - since);
                double sp = s.optDouble("spendable", 0);
                if (sp > 0) s.put("pctUsed", Math.min(999, Math.round(s.optDouble("monthSpent", 0) / sp * 100)));
            }
            JSONArray w = s.optJSONArray("week");
            if (w != null) { double t = 0; for (int i = 0; i < w.length(); i++) t += w.getJSONObject(i).optDouble("v", 0); s.put("weekTotal", t); }
        } catch (Exception ignored) { }
        return s;
    }

    static boolean has(JSONObject s, String k) { return s.has(k) && !s.isNull(k); }
    static String cur(JSONObject s) { return s.optString("currency", "₹"); }
    static String money(JSONObject s, double v) { return (v < 0 ? "−" : "") + Scheduler.money(cur(s), v); }

    static PendingIntent open(Context c) {
        Intent i = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c, 21, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /** Opens the add sheet; extra is an optional query string such as "skip=1". */
    static PendingIntent add(Context c, String extra, int code) {
        Intent i = new Intent(c, MainActivity.class).setAction(Intent.ACTION_VIEW)
            .setData(Uri.parse("kharcha://add" + (extra == null ? "" : "?" + extra)))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c, code, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static RemoteViews views(Context c, int layout) {
        RemoteViews v = new RemoteViews(c.getPackageName(), layout);
        return v;
    }
}
