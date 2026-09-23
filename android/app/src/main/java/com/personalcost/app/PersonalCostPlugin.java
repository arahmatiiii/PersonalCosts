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

    /** Called by CaptureStore when something new is queued, so an open app ingests it immediately. */
    static void notifyCapture() {
        PersonalCostPlugin p = instance;
        if (p != null) p.notifyListeners("capture", new JSObject());
    }

    private Context ctx() {
        return getContext();
    }

    @PluginMethod
    public void setFilters(PluginCall call) {
        JSONArray packages = call.getArray("packages", new JSArray());
        JSONArray senders = call.getArray("senders", new JSArray());
        CaptureStore.setFilters(ctx(), packages, senders, call.getBoolean("captureAll", false));
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
        Context c = ctx();
        JSObject ret = new JSObject();
        ret.put("notificationListener", NotificationManagerCompat.getEnabledListenerPackages(c).contains(c.getPackageName()));
        ret.put("sms", granted(Manifest.permission.RECEIVE_SMS) && granted(Manifest.permission.READ_SMS));
        ret.put("postNotifications", Build.VERSION.SDK_INT >= 33
                ? granted(Manifest.permission.POST_NOTIFICATIONS)
                : NotificationManagerCompat.from(c).areNotificationsEnabled());
        PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
        ret.put("batteryOptimizationIgnored", pm.isIgnoringBatteryOptimizations(c.getPackageName()));
        ret.put("pendingCaptures", CaptureStore.queue(c).length());
        call.resolve(ret);
    }

    @PluginMethod
    public void openNotificationListenerSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx().startActivity(i);
        call.resolve();
    }

    @PluginMethod
    public void requestSmsPermission(PluginCall call) {
        requestPermissionForAlias("sms", call, "permissionDone");
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33) {
            call.resolve();
            return;
        }
        requestPermissionForAlias("notifications", call, "permissionDone");
    }

    @PermissionCallback
    private void permissionDone(PluginCall call) {
        call.resolve();
    }

    @SuppressLint("BatteryLife") // sideloaded personal app; the listener must not be killed
    @PluginMethod
    public void requestIgnoreBatteryOptimization(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + ctx().getPackageName()))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx().startActivity(i);
        call.resolve();
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
    public void setUntaggedCount(PluginCall call) {
        CaptureStore.setUntaggedCount(ctx(), call.getInt("count", 0));
        call.resolve();
    }

    private boolean granted(String permission) {
        return ContextCompat.checkSelfPermission(ctx(), permission) == PackageManager.PERMISSION_GRANTED;
    }
}
