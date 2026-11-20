package com.flameblizzard.kharcha;

import android.content.Context;
import android.os.Bundle;
import android.widget.RemoteViews;

/** "Quick add" 4x1: "+ Add expense" and "Skipped it" (opens the add sheet with ?skip=1). */
public class QuickBarWidget extends BaseWidget {
    @Override
    RemoteViews build(Context c, Bundle opts) {
        RemoteViews v = views(c, R.layout.kw_quickbar);
        v.setOnClickPendingIntent(R.id.w_root, open(c));
        v.setOnClickPendingIntent(R.id.w_add, add(c, null, 24));
        v.setOnClickPendingIntent(R.id.w_skip, add(c, "skip=1", 25));
        return v;
    }
}
