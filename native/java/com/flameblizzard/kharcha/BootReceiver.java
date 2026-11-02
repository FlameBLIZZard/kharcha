package com.flameblizzard.kharcha;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Puts the quick-add notification back after the phone restarts. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        if (i != null && Intent.ACTION_BOOT_COMPLETED.equals(i.getAction())) Notifier.showQuickAdd(c.getApplicationContext());
    }
}
