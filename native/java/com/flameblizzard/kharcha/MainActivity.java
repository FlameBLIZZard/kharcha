package com.flameblizzard.kharcha;

import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.TextView;
import com.getcapacitor.BridgeActivity;
import java.net.URLEncoder;

public class MainActivity extends BridgeActivity {
    private static final long GRACE_MS = 30_000;
    private static final int KEYGUARD_REQ = 4712;
    private boolean unlocked = false, prompting = false;
    private long stoppedAt = 0;
    private View cover;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(KharchaNativePlugin.class);
        setIntent(shareToLink(getIntent()));
        super.onCreate(savedInstanceState);
        Scheduler.schedule(getApplicationContext());
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

    /* ---------- app lock: fingerprint / face / screen lock, with a 30 second grace when you switch away ---------- */

    static boolean lockOn(Context c) { return c.getSharedPreferences("kharcha_native", MODE_PRIVATE).getBoolean("lock", false); }

    static boolean lockAvailable(Context c) {
        KeyguardManager km = (KeyguardManager) c.getSystemService(Context.KEYGUARD_SERVICE);
        if (km == null) return false;
        return Build.VERSION.SDK_INT >= 23 ? km.isDeviceSecure() : km.isKeyguardSecure();
    }

    @Override
    public void onPause() {
        super.onPause();
        if (lockOn(this) && lockAvailable(this)) showCover();   // keeps the numbers out of the recent-apps preview
    }

    @Override
    public void onStop() {
        super.onStop();
        if (unlocked) stoppedAt = SystemClock.elapsedRealtime();
    }

    @Override
    public void onResume() {
        super.onResume();
        if (!lockOn(this) || !lockAvailable(this)) { unlocked = true; hideCover(); return; }   // no screen lock set up: never lock anyone out
        if (unlocked && (stoppedAt == 0 || SystemClock.elapsedRealtime() - stoppedAt < GRACE_MS)) { stoppedAt = 0; hideCover(); return; }
        unlocked = false;
        showCover();
        if (!prompting) prompt();
    }

    private void showCover() {
        if (cover == null) {
            FrameLayout f = new FrameLayout(this);
            f.setBackgroundColor(Color.BLACK);
            f.setClickable(true);
            TextView t = new TextView(this);
            t.setText("Kharcha is locked\nTap to unlock");
            t.setTextColor(Color.parseColor("#8A8A8A"));
            t.setTextSize(15);
            t.setGravity(Gravity.CENTER);
            f.addView(t, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            f.setOnClickListener(v -> { if (!prompting && !unlocked) prompt(); });
            addContentView(f, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            cover = f;
        }
        cover.setVisibility(View.VISIBLE);
        cover.bringToFront();
    }

    private void hideCover() { if (cover != null) cover.setVisibility(View.GONE); }

    private void onUnlocked() { unlocked = true; prompting = false; stoppedAt = 0; hideCover(); }

    private void prompt() {
        prompting = true;
        if (Build.VERSION.SDK_INT >= 28) {
            android.hardware.biometrics.BiometricPrompt.Builder b = new android.hardware.biometrics.BiometricPrompt.Builder(this)
                .setTitle("Unlock Kharcha")
                .setSubtitle("Your spending stays private");
            if (Build.VERSION.SDK_INT >= 30) {
                b.setAllowedAuthenticators(android.hardware.biometrics.BiometricManager.Authenticators.BIOMETRIC_WEAK
                    | android.hardware.biometrics.BiometricManager.Authenticators.DEVICE_CREDENTIAL);
            } else if (Build.VERSION.SDK_INT == 29) {
                b.setDeviceCredentialAllowed(true);
            } else {
                b.setNegativeButton("Use PIN", getMainExecutor(), (d, w) -> { prompting = false; keyguard(); });
            }
            try {
                b.build().authenticate(new CancellationSignal(), getMainExecutor(), new android.hardware.biometrics.BiometricPrompt.AuthenticationCallback() {
                    @Override public void onAuthenticationSucceeded(android.hardware.biometrics.BiometricPrompt.AuthenticationResult r) { onUnlocked(); }
                    @Override public void onAuthenticationError(int code, CharSequence msg) {
                        prompting = false;
                        // 1 = hardware unavailable, 11 = no fingerprints enrolled, 12 = no hardware: fall back to the screen lock
                        if (Build.VERSION.SDK_INT < 30 && (code == 1 || code == 11 || code == 12)) keyguard();
                    }
                });
            } catch (Exception e) { prompting = false; keyguard(); }
        } else {
            keyguard();
        }
    }

    @SuppressWarnings("deprecation")
    private void keyguard() {
        KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
        Intent i = km == null ? null : km.createConfirmDeviceCredentialIntent("Unlock Kharcha", "Your spending stays private");
        if (i == null) { onUnlocked(); return; }   // no screen lock after all
        prompting = true;
        startActivityForResult(i, KEYGUARD_REQ);
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req != KEYGUARD_REQ) return;
        prompting = false;
        if (res == RESULT_OK) onUnlocked();
    }
}
