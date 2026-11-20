package com.flameblizzard.kharcha;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Bridge between the web app and the Android notification features. */
@CapacitorPlugin(name = "KharchaNative")
public class KharchaNativePlugin extends Plugin {
    @PluginMethod
    public void status(PluginCall call) {
        Context c = getContext();
        JSObject o = new JSObject();
        o.put("listener", NotificationManagerCompat.getEnabledListenerPackages(c).contains(c.getPackageName()));
        o.put("notifications", NotificationManagerCompat.from(c).areNotificationsEnabled());
        o.put("overlay", android.os.Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(c));
        call.resolve(o);
    }

    @PluginMethod
    public void setCats(PluginCall call) {
        JSArray a = call.getArray("cats");
        if (a != null) Store.setCats(getContext(), a.toString());
        call.resolve();
    }

    @PluginMethod
    public void openOverlaySettings(PluginCall call) {
        start(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, android.net.Uri.parse("package:" + getContext().getPackageName())));
        call.resolve();
    }

    @PluginMethod
    public void showQuickAdd(PluginCall call) {
        Notifier.showQuickAdd(getContext());
        call.resolve();
    }

    @PluginMethod
    public void openAccessSettings(PluginCall call) {
        start(new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS"));
        call.resolve();
    }

    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        start(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
        call.resolve();
    }

    @PluginMethod
    public void requestNotifications(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getActivity() != null) {
            ActivityCompat.requestPermissions(getActivity(), new String[]{"android.permission.POST_NOTIFICATIONS"}, 4711);
        }
        call.resolve();
    }

    @PluginMethod
    public void drain(PluginCall call) {
        JSObject o = new JSObject();
        try { o.put("items", new JSArray(Store.drain(getContext()))); } catch (Exception e) { o.put("items", new JSArray()); }
        call.resolve(o);
    }

    @PluginMethod
    public void test(PluginCall call) {
        Detector.handle(getContext(), "Rs.249.00 debited from A/c XX1234 on 02-11-26 to VPA swiggy@icici UPI Ref 123456", true);
        call.resolve();
    }

    /** Saves a text file (backup JSON or CSV) into Downloads/Kharcha. WebViews cannot do blob downloads. */
    @PluginMethod
    public void saveText(PluginCall call) {
        String name = call.getString("name", "kharcha.txt");
        String text = call.getString("text", "");
        String mime = call.getString("mime", "text/plain");
        Context c = getContext();
        try {
            JSObject o = new JSObject();
            if (Build.VERSION.SDK_INT >= 29) {
                android.content.ContentValues v = new android.content.ContentValues();
                v.put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME, name);
                v.put(android.provider.MediaStore.MediaColumns.MIME_TYPE, mime);
                v.put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH, android.os.Environment.DIRECTORY_DOWNLOADS + "/Kharcha");
                android.net.Uri uri = c.getContentResolver().insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (uri == null) throw new Exception("could not create the file");
                java.io.OutputStream os = c.getContentResolver().openOutputStream(uri);
                try { os.write(text.getBytes("UTF-8")); } finally { os.close(); }
                o.put("where", "Downloads/Kharcha");
            } else {
                Intent s = new Intent(Intent.ACTION_SEND);
                s.setType("text/plain");
                s.putExtra(Intent.EXTRA_SUBJECT, name);
                s.putExtra(Intent.EXTRA_TEXT, text);
                start(Intent.createChooser(s, "Save " + name));
                o.put("where", "the share sheet");
            }
            call.resolve(o);
        } catch (Exception e) {
            call.reject("Could not save the file: " + e.getMessage());
        }
    }

    /** Home-screen widget numbers: { amount: "₹683", label: "Safe to spend today", line: "Spent ₹420 of ₹1,103" }. */
    @PluginMethod
    public void setWidget(PluginCall call) {
        com.getcapacitor.JSObject st = call.getObject("stats");
        KharchaWidget.set(getContext(), call.getString("amount", ""), call.getString("label", ""), call.getString("line", ""), st == null ? null : st.toString());
        call.resolve();
    }

    /** True if the phone has a screen lock (PIN, pattern, fingerprint or face), which the app lock needs. */
    @PluginMethod
    public void lockAvailable(PluginCall call) {
        JSObject o = new JSObject();
        o.put("available", MainActivity.lockAvailable(getContext()));
        call.resolve(o);
    }

    @PluginMethod
    public void setLock(PluginCall call) {
        getContext().getSharedPreferences("kharcha_native", Context.MODE_PRIVATE).edit().putBoolean("lock", Boolean.TRUE.equals(call.getBoolean("on", false))).apply();
        call.resolve();
    }

    /** Bills, recap numbers and on/off switches for the reminder and recap notifications. */
    @PluginMethod
    public void setSchedule(PluginCall call) {
        Scheduler.save(getContext(), call.getData().toString());
        call.resolve();
    }

    /** Posts the bill reminders and both recaps right now, ignoring the day rules (for a "preview" button). */
    @PluginMethod
    public void previewSchedule(PluginCall call) {
        Scheduler.tick(getContext(), "all", true);
        call.resolve();
    }

    @PluginMethod
    public void appInfo(PluginCall call) {
        JSObject o = new JSObject();
        try {
            android.content.pm.PackageInfo pi = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            o.put("versionName", pi.versionName);
            o.put("versionCode", Build.VERSION.SDK_INT >= 28 ? pi.getLongVersionCode() : pi.versionCode);
        } catch (Exception e) { o.put("versionName", "?"); o.put("versionCode", 0); }
        call.resolve(o);
    }

    private void start(Intent i) {
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try { getContext().startActivity(i); } catch (Exception ignored) { }
    }
}
