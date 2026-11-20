package com.flameblizzard.kharcha;

import android.content.Context;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONObject;

/** "Goal": the first unfinished savings goal, its progress bar and saved / target. */
public class GoalWidget extends BaseWidget {
    @Override
    RemoteViews build(Context c, Bundle opts) {
        JSONObject s = stats(c);
        RemoteViews v = views(c, R.layout.kw_bar_card);
        v.setOnClickPendingIntent(R.id.w_root, open(c));
        JSONObject g = s.optJSONObject("goal");
        if (g == null) {
            v.setTextViewText(R.id.w_label, "Goal");
            v.setTextViewText(R.id.w_amount, "No goal yet");
            v.setViewVisibility(R.id.w_bar, View.GONE);
            v.setTextViewText(R.id.w_line, "Tap to add one in Kharcha");
            return v;
        }
        int pct = Math.max(0, Math.min(100, g.optInt("pct", 0)));
        String emoji = g.optString("emoji", "");
        v.setTextViewText(R.id.w_label, (emoji.isEmpty() ? "" : emoji + "  ") + g.optString("name", "Goal"));
        v.setTextViewText(R.id.w_amount, pct >= 100 ? "Done!" : pct + "%");
        v.setViewVisibility(R.id.w_bar, View.VISIBLE);
        v.setProgressBar(R.id.w_bar, 100, pct, false);
        v.setTextViewText(R.id.w_line, money(s, g.optDouble("saved", 0)) + " / " + money(s, g.optDouble("target", 0)));
        return v;
    }
}
