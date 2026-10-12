package com.personalcost.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Set;

/** JS side: src/native/personalCost.ts */
@CapacitorPlugin(
        name = "PersonalCost",
        permissions = {
                @Permission(alias = "sms", strings = {Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS}),
                @Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS}),
        })
public class PersonalCostPlugin extends Plugin {
    private static volatile PersonalCostPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) instance = null;
    }

    /** Called by CaptureStore when an SMS is queued, so an open app ingests it immediately. */
    static void notifyCapture() {
        PersonalCostPlugin p = instance;
        if (p != null) p.notifyListeners("capture", new JSObject());
    }

    private Context ctx() {
        return getContext();
    }

    @PluginMethod
    public void setSenders(PluginCall call) {
        CaptureStore.setSenders(ctx(), call.getArray("senders", new JSArray()));
        call.resolve();
    }

    @PluginMethod
    public void getCaptures(PluginCall call) {
        JSONArray q = CaptureStore.queue(ctx());
        JSArray out = new JSArray();
        for (int i = 0; i < q.length(); i++) {
            JSONObject o = q.optJSONObject(i);
            if (o != null) out.put(o);
        }
        JSObject ret = new JSObject();
        ret.put("captures", out);
        call.resolve(ret);
    }

    @PluginMethod
    public void ackCaptures(PluginCall call) {
        JSONArray ids = call.getArray("ids", new JSArray());
        Set<String> set = new HashSet<>();
        for (int i = 0; i < ids.length(); i++) set.add(ids.optString(i));
        CaptureStore.ack(ctx(), set);
        call.resolve();
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(status());
    }

    /**
     * One button, one flow: ask for SMS + notification permissions together, then (if needed) open
     * the battery-optimization exemption dialog so Android doesn't kill SMS delivery to the app.
     */
    @PluginMethod
    public void requestAll(PluginCall call) {
        boolean needPerms = !granted(Manifest.permission.RECEIVE_SMS) || !granted(Manifest.permission.READ_SMS)
                || (Build.VERSION.SDK_INT >= 33 && !granted(Manifest.permission.POST_NOTIFICATIONS));
        if (needPerms) {
            String[] aliases = Build.VERSION.SDK_INT >= 33 ? new String[]{"sms", "notifications"} : new String[]{"sms"};
            requestPermissionForAliases(aliases, call, "afterPermissions");
        } else {
            afterPermissions(call);
        }
    }

    @SuppressLint("BatteryLife") // sideloaded personal app; SMS capture must not be killed
    @PermissionCallback
    private void afterPermissions(PluginCall call) {
        PowerManager pm = (PowerManager) ctx().getSystemService(Context.POWER_SERVICE);
        if (!pm.isIgnoringBatteryOptimizations(ctx().getPackageName())) {
            Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + ctx().getPackageName()))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx().startActivity(i);
        }
        call.resolve(status());
    }

    @PluginMethod
    public void setReminder(PluginCall call) {
        CaptureStore.setReminder(ctx(),
                call.getBoolean("enabled", true),
                call.getInt("hour", 22),
                call.getInt("minute", 0));
        ReminderReceiver.schedule(ctx());
        call.resolve();
    }

    @PluginMethod
    public void setWidget(PluginCall call) {
        CaptureStore.setWidget(ctx(), call.getData());
        SpendWidget.refresh(ctx());
        call.resolve();
    }

    @PluginMethod
    public void setUntaggedCount(PluginCall call) {
        CaptureStore.setUntaggedCount(ctx(), call.getInt("count", 0));
        call.resolve();
    }

    private JSObject status() {
        Context c = ctx();
        JSObject ret = new JSObject();
        ret.put("sms", granted(Manifest.permission.RECEIVE_SMS) && granted(Manifest.permission.READ_SMS));
        ret.put("postNotifications", Build.VERSION.SDK_INT >= 33
                ? granted(Manifest.permission.POST_NOTIFICATIONS)
                : NotificationManagerCompat.from(c).areNotificationsEnabled());
        PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
        ret.put("batteryOptimizationIgnored", pm.isIgnoringBatteryOptimizations(c.getPackageName()));
        return ret;
    }

    private boolean granted(String permission) {
        return ContextCompat.checkSelfPermission(ctx(), permission) == PackageManager.PERMISSION_GRANTED;
    }
}
