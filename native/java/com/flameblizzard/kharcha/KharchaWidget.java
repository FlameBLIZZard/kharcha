package com.flameblizzard.kharcha;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.widget.RemoteViews;
import org.json.JSONObject;

/** "Today" widget: safe to spend today (or over by), spent today, and a + button. Also the entry point for pushes. */
public class KharchaWidget extends BaseWidget {

    /** Called from the web app with fresh numbers. Resets the "logged since" counter. */
    static void set(Context c, String amount, String label, String line, String statsJson) {
        sp(c).edit().putString("amount", amount).putString("label", label).putString("line", line)
            .putString("stats", statsJson == null ? "{}" : statsJson).putLong("setAt", System.currentTimeMillis())
            .putString("day", today()).putFloat("since", 0f).putFloat("sinceT", 0f).apply();
        refreshAll(c);
    }

    /** An expense was saved from a notification while the app was closed: count it until the app pushes fresh numbers. */
    static void logged(Context c, double amt) {
        SharedPreferences p = sp(c);
        float todayPart = today().equals(p.getString("sinceDay", "")) ? p.getFloat("sinceT", 0f) : 0f;
        p.edit().putFloat("since", p.getFloat("since", 0f) + (float) amt).putFloat("sinceT", todayPart + (float) amt)
            .putString("sinceDay", today()).apply();
        refreshAll(c);
    }

    static void refresh(Context c) { refreshAll(c); }

    @Override
    RemoteViews build(Context c, Bundle opts) {
        SharedPreferences p = sp(c);
        JSONObject s = stats(c);
        RemoteViews v = views(c, R.layout.kharcha_widget);
        boolean stale = s.optBoolean("stale", false);
        if (has(s, "safeToday")) {
            double safe = s.optDouble("safeToday", 0);
            v.setTextViewText(R.id.w_label, safe < 0 ? "Over today by" : "Safe to spend today");
            v.setTextViewText(R.id.w_amount, money(s, Math.abs(safe)));
            double t = s.optDouble("todaySpent", 0);
            v.setTextViewText(R.id.w_line, t > 0 ? "Spent " + money(s, t) + " today" : "Nothing spent yet today");
        } else if (s.has("todaySpent")) {
            v.setTextViewText(R.id.w_label, stale ? "Today · open to refresh" : "Spent today");
            v.setTextViewText(R.id.w_amount, money(s, s.optDouble("todaySpent", 0)));
            v.setTextViewText(R.id.w_line, money(s, s.optDouble("monthSpent", 0)) + " this month");
        } else if (!p.getString("amount", "").isEmpty()) {   // older app build: plain strings only
            v.setTextViewText(R.id.w_label, today().equals(p.getString("day", "")) ? p.getString("label", "") : "Yesterday · open to refresh");
            v.setTextViewText(R.id.w_amount, p.getString("amount", ""));
            v.setTextViewText(R.id.w_line, p.getString("line", ""));
        } else {
            v.setTextViewText(R.id.w_label, "Kharcha");
            v.setTextViewText(R.id.w_amount, "Tap to set up");
            v.setTextViewText(R.id.w_line, "Open the app once and this fills in");
        }
        v.setOnClickPendingIntent(R.id.w_root, open(c));
        v.setOnClickPendingIntent(R.id.w_add, add(c, null, 22));
        return v;
    }
}
