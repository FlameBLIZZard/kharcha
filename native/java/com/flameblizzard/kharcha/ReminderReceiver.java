package com.flameblizzard.kharcha;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.widget.Toast;
import androidx.core.app.NotificationManagerCompat;
import org.json.JSONObject;

/** Daily alarms (bill reminders, recaps) and the "Mark paid" button on a bill reminder. */
public class ReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        Context app = c.getApplicationContext();
        String kind = i.getStringExtra("kind");
        if (!"paid".equals(kind)) { Scheduler.tick(app, kind, false); return; }
        try {
            String id = i.getStringExtra("id"), month = i.getStringExtra("month"), name = i.getStringExtra("name");
            double amt = i.getDoubleExtra("amt", 0);
            JSONObject o = new JSONObject();
            o.put("id", "bill-" + id + "-" + month);   // the web app skips ids it already has, so a second tap can't double-log
            o.put("amt", amt);
            o.put("cat", i.getStringExtra("cat") == null ? "bills" : i.getStringExtra("cat"));
            o.put("note", name);
            o.put("ts", System.currentTimeMillis());
            Store.add(app, o);
            Scheduler.sp(app).edit().putBoolean("paid-" + id + "-" + month, true).apply();
            Toast.makeText(app, "Logged " + Scheduler.money("₹", amt) + " · " + name, Toast.LENGTH_SHORT).show();
        } catch (Exception ignored) { }
        NotificationManagerCompat.from(app).cancel(i.getIntExtra("nid", 0));
    }
}
