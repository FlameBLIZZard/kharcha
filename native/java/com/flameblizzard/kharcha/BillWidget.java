package com.flameblizzard.kharcha;

import android.content.Context;
import android.os.Bundle;
import android.widget.RemoteViews;
import org.json.JSONObject;

/** "Next bill": the next subscription or bill, its amount and when it is due. */
public class BillWidget extends BaseWidget {
    @Override
    RemoteViews build(Context c, Bundle opts) {
        JSONObject s = stats(c);
        RemoteViews v = views(c, R.layout.kw_text_card);
        v.setOnClickPendingIntent(R.id.w_root, open(c));
        JSONObject b = s.optJSONObject("bill");
        if (b == null) {
            v.setTextViewText(R.id.w_label, "Next bill");
            v.setTextViewText(R.id.w_amount, "None coming up");
            v.setTextViewText(R.id.w_line, "Add bills in Kharcha › Setup");
            return v;
        }
        int left = b.optInt("left", 0);
        String when = left <= 0 ? "today" : left == 1 ? "tomorrow" : "in " + left + " days";
        v.setTextViewText(R.id.w_label, "Next bill · " + when);
        v.setTextViewText(R.id.w_amount, b.optString("name", "Bill"));
        v.setTextViewText(R.id.w_line, money(s, b.optDouble("amt", 0)));
        return v;
    }
}
