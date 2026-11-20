package com.flameblizzard.kharcha;

import android.content.Context;
import android.os.Bundle;
import android.widget.RemoteViews;
import org.json.JSONObject;

/** "Pulse": your streak and the category you spent most on this month. */
public class PulseWidget extends BaseWidget {
    @Override
    RemoteViews build(Context c, Bundle opts) {
        JSONObject s = stats(c);
        RemoteViews v = views(c, R.layout.kw_pulse);
        v.setOnClickPendingIntent(R.id.w_root, open(c));
        int n = s.optInt("streak", 0);
        v.setTextViewText(R.id.w_streak, s.has("streak") ? String.valueOf(n) : "—");
        JSONObject t = s.optJSONObject("top");
        if (t == null) {
            v.setTextViewText(R.id.w_top, "—");
            v.setTextViewText(R.id.w_top_amt, "Nothing logged yet");
        } else {
            v.setTextViewText(R.id.w_top, t.optString("name", ""));
            v.setTextViewText(R.id.w_top_amt, money(s, t.optDouble("amt", 0)));
        }
        return v;
    }
}
