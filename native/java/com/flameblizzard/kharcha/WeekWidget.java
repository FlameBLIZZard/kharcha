package com.flameblizzard.kharcha;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.os.Bundle;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

/** "Week chart": seven bars for the last seven days, today's in white. Drawn into a bitmap, so no storage is involved. */
public class WeekWidget extends BaseWidget {
    @Override
    RemoteViews build(Context c, Bundle opts) {
        JSONObject s = stats(c);
        RemoteViews v = views(c, R.layout.kw_week);
        v.setOnClickPendingIntent(R.id.w_root, open(c));
        JSONArray w = s.optJSONArray("week");
        if (w == null || w.length() == 0) {
            v.setTextViewText(R.id.w_label, "LAST 7 DAYS · OPEN KHARCHA");
            v.setTextViewText(R.id.w_amount, "—");
            return v;
        }
        v.setTextViewText(R.id.w_label, "LAST 7 DAYS");
        v.setTextViewText(R.id.w_amount, money(s, s.optDouble("weekTotal", 0)));
        float dens = c.getResources().getDisplayMetrics().density;
        int wDp = opts == null ? 0 : opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        int hDp = opts == null ? 0 : opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
        if (wDp <= 0) wDp = 250;
        if (hDp <= 0) hDp = 110;
        int bw = (int) Math.min(1000, Math.max(160, (wDp - 28) * dens));
        int bh = (int) Math.min(500, Math.max(70, (hDp - 28 - 34) * dens));
        v.setImageViewBitmap(R.id.w_chart, chart(w, bw, bh, dens));
        return v;
    }

    private static Bitmap chart(JSONArray w, int bw, int bh, float dens) {
        Bitmap b = Bitmap.createBitmap(bw, bh, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(b);
        Paint bar = new Paint(Paint.ANTI_ALIAS_FLAG), txt = new Paint(Paint.ANTI_ALIAS_FLAG);
        txt.setTextSize(11 * dens);
        txt.setTextAlign(Paint.Align.CENTER);
        txt.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        int n = w.length();
        double max = 1;
        for (int i = 0; i < n; i++) max = Math.max(max, w.optJSONObject(i) == null ? 0 : w.optJSONObject(i).optDouble("v", 0));
        float labelH = 16 * dens, gap = 8 * dens, colW = (bw - gap * (n - 1)) / (float) n, top = 2 * dens, area = bh - labelH - top;
        float r = Math.min(colW / 2, 7 * dens);
        for (int i = 0; i < n; i++) {
            JSONObject d = w.optJSONObject(i);
            double val = d == null ? 0 : d.optDouble("v", 0);
            boolean today = i == n - 1;
            float x = i * (colW + gap), h = Math.max(3 * dens, (float) (val / max * area));
            bar.setColor(today ? Color.WHITE : Color.parseColor(val > 0 ? "#5A5A5A" : "#262626"));
            cv.drawRoundRect(new RectF(x, top + area - h, x + colW, top + area), r, r, bar);
            txt.setColor(today ? Color.WHITE : Color.parseColor("#8A8A8A"));
            cv.drawText(d == null ? "" : d.optString("d", ""), x + colW / 2, bh - 3 * dens, txt);
        }
        return b;
    }
}
