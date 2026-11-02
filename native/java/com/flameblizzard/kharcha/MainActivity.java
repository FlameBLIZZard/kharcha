package com.flameblizzard.kharcha;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import java.net.URLEncoder;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(KharchaNativePlugin.class);
        setIntent(shareToLink(getIntent()));
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(shareToLink(intent));
    }

    /** "Share" -> Kharcha with some text (a bank SMS, a receipt) becomes kharcha://add?text=... */
    private static Intent shareToLink(Intent i) {
        try {
            if (i != null && Intent.ACTION_SEND.equals(i.getAction()) && i.getType() != null && i.getType().startsWith("text/")) {
                String t = i.getStringExtra(Intent.EXTRA_TEXT);
                if (t != null) {
                    i.setAction(Intent.ACTION_VIEW);
                    i.setData(Uri.parse("kharcha://add?text=" + URLEncoder.encode(t, "UTF-8")));
                }
            }
        } catch (Exception ignored) { }
        return i;
    }
}
