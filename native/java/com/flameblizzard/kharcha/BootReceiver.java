package com.flameblizzard.kharcha;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Puts the quick-add notification and the daily reminder alarms back after a restart or an app update. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        if (i == null) return;
        String a = i.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(a) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)) {
            Notifier.showQuickAdd(c.getApplicationContext());
            Scheduler.schedule(c.getApplicationContext());
            KharchaWidget.refresh(c.getApplicationContext());
        }
    }
}
