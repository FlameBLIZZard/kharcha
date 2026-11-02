package com.flameblizzard.kharcha;

import android.accessibilityservice.AccessibilityService;
import android.os.SystemClock;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import java.util.ArrayList;

/**
 * Reads the text on UPI apps' screens (BHIM, GPay, PhonePe, Paytm; see kharcha_accessibility.xml for the list)
 * and shows the quick popup when a "payment successful" screen appears. Nothing is stored or sent anywhere.
 */
public class PayWatcher extends AccessibilityService {
    private long last = 0;

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        try {
            long now = SystemClock.uptimeMillis();
            if (now - last < 500) return;
            last = now;
            AccessibilityNodeInfo root = getRootInActiveWindow();
            if (root == null) return;
            ArrayList<String> texts = new ArrayList<>();
            collect(root, texts, 0);
            Detector.handleScreen(getApplicationContext(), texts);
        } catch (Exception ignored) { }
    }

    private void collect(AccessibilityNodeInfo n, ArrayList<String> out, int depth) {
        if (n == null || depth > 40 || out.size() > 250) return;
        CharSequence t = n.getText();
        if (t != null && t.length() > 0) out.add(t.toString());
        else {
            CharSequence d = n.getContentDescription();
            if (d != null && d.length() > 0) out.add(d.toString());
        }
        for (int i = 0; i < n.getChildCount(); i++) collect(n.getChild(i), out, depth + 1);
    }

    @Override
    public void onInterrupt() { }
}
