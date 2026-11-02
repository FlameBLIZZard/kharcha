package com.flameblizzard.kharcha;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.widget.Toast;
import androidx.core.app.NotificationManagerCompat;
import org.json.JSONObject;

/** Handles the buttons on the popup notification without opening the app. */
public class ActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        int id = i.getIntExtra("id", 0);
        NotificationManagerCompat.from(c).cancel(id);
        if (!"save".equals(i.getStringExtra("what"))) return;
        try {
            String amt = i.getStringExtra("amt");
            String merchant = i.getStringExtra("merchant");
            String cat = i.getStringExtra("cat");
            JSONObject o = new JSONObject();
            o.put("id", "n" + id);
            o.put("amt", Double.parseDouble(amt));
            o.put("cat", cat);
            o.put("note", merchant == null ? "" : merchant);
            o.put("ts", System.currentTimeMillis());
            Store.add(c, o);
            Toast.makeText(c, "Saved ₹" + amt + " · " + Notifier.label(cat), Toast.LENGTH_SHORT).show();
        } catch (Exception ignored) { }
    }
}
