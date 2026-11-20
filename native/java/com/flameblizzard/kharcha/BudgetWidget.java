package com.flameblizzard.kharcha;

import android.content.Context;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONObject;

/** "Budget left": what is left of this month's spendable money, a bar of how much is used, days left. */
public class BudgetWidget extends BaseWidget {
    @Override
    RemoteViews build(Context c, Bundle opts) {
        JSONObject s = stats(c);
        RemoteViews v = views(c, R.layout.kw_bar_card);
        v.setOnClickPendingIntent(R.id.w_root, open(c));
        if (has(s, "budgetLeft")) {
            double left = s.optDouble("budgetLeft", 0);
            int pct = s.optInt("pctUsed", 0);
            int days = s.optInt("daysLeft", 0);
            v.setTextViewText(R.id.w_label, left < 0 ? "Over budget by" : "Budget left");
            v.setTextViewText(R.id.w_amount, money(s, Math.abs(left)));
            v.setViewVisibility(R.id.w_bar, View.VISIBLE);
            v.setProgressBar(R.id.w_bar, 100, Math.max(0, Math.min(100, pct)), false);
            v.setTextViewText(R.id.w_line, (days > 0 ? days + " day" + (days == 1 ? "" : "s") + " left · " : "") + pct + "% used");
        } else if (s.has("monthSpent")) {
            v.setTextViewText(R.id.w_label, "Spent this month");
            v.setTextViewText(R.id.w_amount, money(s, s.optDouble("monthSpent", 0)));
            v.setViewVisibility(R.id.w_bar, View.GONE);
            v.setTextViewText(R.id.w_line, "Add your income in Kharcha for a budget");
        } else {
            v.setTextViewText(R.id.w_label, "Budget left");
            v.setTextViewText(R.id.w_amount, "—");
            v.setViewVisibility(R.id.w_bar, View.GONE);
            v.setTextViewText(R.id.w_line, "Open Kharcha once to fill this in");
        }
        return v;
    }
}
