import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import type { Capture } from "../lib/ingest";

/**
 * Bridge to the native Android side (android/app/src/main/java/com/personalcost/app/PersonalCostPlugin.java).
 * On the web (GitHub Pages) none of this exists — isNative is false and the app is manual-entry only.
 */
export interface CaptureStatus {
  notificationListener: boolean;
  sms: boolean;
  postNotifications: boolean;
  batteryOptimizationIgnored: boolean;
  pendingCaptures: number;
}

interface PersonalCostPlugin {
  /** Which packages / SMS senders the native side should keep (everything else is ignored). */
  setFilters(opts: { packages: string[]; senders: string[]; captureAll: boolean }): Promise<void>;
  /** Captures queued natively since the last ack (they survive the app being closed). */
  getCaptures(): Promise<{ captures: Capture[] }>;
  ackCaptures(opts: { ids: string[] }): Promise<void>;
  getStatus(): Promise<CaptureStatus>;
  openNotificationListenerSettings(): Promise<void>;
  requestSmsPermission(): Promise<void>;
  requestNotificationPermission(): Promise<void>;
  requestIgnoreBatteryOptimization(): Promise<void>;
  /** Daily reminder, fired natively by AlarmManager. */
  setReminder(opts: { enabled: boolean; hour: number; minute: number }): Promise<void>;
  /** So the native reminder can say "N untagged" without starting the WebView. */
  setUntaggedCount(opts: { count: number }): Promise<void>;
  addListener(event: "capture", fn: () => void): Promise<PluginListenerHandle>;
}

export const isNative = Capacitor.isNativePlatform();

export const PersonalCost = registerPlugin<PersonalCostPlugin>("PersonalCost");
