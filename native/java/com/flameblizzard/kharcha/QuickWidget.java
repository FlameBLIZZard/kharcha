package com.flameblizzard.kharcha;

import android.content.Context;
import android.os.Bundle;
import android.widget.RemoteViews;

/** "Quick add" 1x1: one tap opens the add sheet, like the quick-settings tile. */
public class QuickWidget extends BaseWidget {
    @Override
    RemoteViews build(Context c, Bundle opts) {
        RemoteViews v = views(c, R.layout.kw_quick);
        v.setOnClickPendingIntent(R.id.w_root, add(c, null, 23));
        return v;
    }
}
