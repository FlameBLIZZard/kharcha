package com.flameblizzard.kharcha;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.widget.Toast;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.RemoteInput;
import org.json.JSONObject;

/** Handles the buttons on the popup notification without opening the app. */
public class ActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        int id = i.getIntExtra("id", 0);
        String what = i.getStringExtra("what");
        String amt = i.getStringExtra("amt");
        String merchant = i.getStringExtra("merchant");
        if (merchant == null) merchant = "";
        String cat = i.getStringExtra("cat");
        try {
            if ("more".equals(what)) {
                Notifier.render(c, id, amt, merchant, i.getStringExtra("guess") == null ? "" : i.getStringExtra("guess"), i.getIntExtra("page", 0));
                return;
            }
            NotificationManagerCompat.from(c).cancel(id);
            if (!"save".equals(what) && !"note".equals(what)) return;
            String note = merchant;
            if ("note".equals(what)) {
                Bundle r = RemoteInput.getResultsFromIntent(i);
                CharSequence typed = r == null ? null : r.getCharSequence("note");
                if (typed != null && typed.toString().trim().length() > 0) {
                    String t = typed.toString().trim();
                    note = merchant.isEmpty() ? t : merchant + " \u2013 " + t;
                }
            }
            JSONObject o = new JSONObject();
            o.put("id", "n" + id);
            o.put("amt", Double.parseDouble(amt));
            o.put("cat", cat);
            o.put("note", note);
            o.put("ts", System.currentTimeMillis());
            Store.add(c, o);
            Toast.makeText(c, "Saved \u20b9" + amt + " \u00b7 " + Notifier.label(c, cat), Toast.LENGTH_SHORT).show();
        } catch (Exception ignored) { }
    }
}
