package com.flameblizzard.kharcha;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;

/** Tiny queue of expenses saved from notification buttons, picked up by the web app. */
final class Store {
    private static SharedPreferences sp(Context c) { return c.getSharedPreferences("kharcha_native", Context.MODE_PRIVATE); }

    static synchronized void add(Context c, JSONObject item) {
        try {
            JSONArray a = new JSONArray(sp(c).getString("pending", "[]"));
            a.put(item);
            sp(c).edit().putString("pending", a.toString()).apply();
        } catch (Exception ignored) { }
    }

    static synchronized String drain(Context c) {
        String s = sp(c).getString("pending", "[]");
        sp(c).edit().putString("pending", "[]").apply();
        return s;
    }

    /** Category list (id, name) in the order set in the app, so popup buttons match the user's own categories. */
    static void setCats(Context c, String json) { sp(c).edit().putString("cats", json).apply(); }
    static java.util.List<String[]> cats(Context c) {
        java.util.List<String[]> out = new java.util.ArrayList<>();
        try {
            JSONArray a = new JSONArray(sp(c).getString("cats", "[]"));
            for (int i = 0; i < a.length(); i++) { JSONObject o = a.getJSONObject(i); out.add(new String[]{o.getString("id"), o.getString("name")}); }
        } catch (Exception ignored) { }
        if (out.isEmpty()) for (int i = 0; i < Notifier.NAMES.length; i++) out.add(new String[]{Notifier.NAMES[i], Notifier.LABELS[i]});
        return out;
    }

    /** True if the same amount was already announced in the last 3 minutes (SMS + app notification for one payment). */
    static synchronized boolean isDuplicate(Context c, double amt) {
        SharedPreferences p = sp(c);
        long now = System.currentTimeMillis();
        boolean dup = Math.abs(p.getFloat("lastAmt", -1f) - amt) < 0.01 && now - p.getLong("lastTs", 0) < 3 * 60 * 1000;
        if (!dup) p.edit().putFloat("lastAmt", (float) amt).putLong("lastTs", now).apply();
        return dup;
    }
}
