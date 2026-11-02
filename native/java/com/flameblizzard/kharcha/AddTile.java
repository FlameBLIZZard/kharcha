package com.flameblizzard.kharcha;

import android.app.PendingIntent;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.service.quicksettings.TileService;

/** "Add expense" tile for the quick-settings panel (swipe down twice, edit, drag it in). */
public class AddTile extends TileService {
    @Override
    public void onClick() {
        Intent i = new Intent(this, MainActivity.class).setAction(Intent.ACTION_VIEW).setData(Uri.parse("kharcha://add"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        if (Build.VERSION.SDK_INT >= 34) {
            startActivityAndCollapse(PendingIntent.getActivity(this, 1, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        } else {
            startActivityAndCollapse(i);
        }
    }
}
