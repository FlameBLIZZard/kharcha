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
        call.resolve(o);
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

    private void start(Intent i) {
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try { getContext().startActivity(i); } catch (Exception ignored) { }
    }
}
