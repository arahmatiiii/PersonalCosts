import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import type { Capture } from "../lib/ingest";

/**
 * Bridge to android/app/src/main/java/com/personalcost/app/PersonalCostPlugin.java.
 * On the web (GitHub Pages) none of this exists — isNative is false.
 */
export interface CaptureStatus {
  sms: boolean;
  postNotifications: boolean;
  batteryOptimizationIgnored: boolean;
}

export interface WidgetData {
  title: string;
  month: string;
  today: string;
  funds: string; // empty: no «پول» this month
  untagged: number;
}

interface PersonalCostPlugin {
  /** SMS senders to capture; everything else is ignored natively. */
  setSenders(opts: { senders: string[] }): Promise<void>;
  /** SMS queued natively since the last ack (they survive the app being closed). */
  getCaptures(): Promise<{ captures: Capture[] }>;
  ackCaptures(opts: { ids: string[] }): Promise<void>;
  getStatus(): Promise<CaptureStatus>;
  /** One flow: SMS + notification permissions, then the battery-optimization exemption. */
  requestAll(): Promise<CaptureStatus>;
  setReminder(opts: { enabled: boolean; hour: number; minute: number }): Promise<void>;
  setUntaggedCount(opts: { count: number }): Promise<void>;
  /** Pre-formatted texts for the home-screen widget. */
  setWidget(opts: WidgetData): Promise<void>;
  addListener(event: "capture", fn: () => void): Promise<PluginListenerHandle>;
}

export const isNative = Capacitor.isNativePlatform();

export const PersonalCost = registerPlugin<PersonalCostPlugin>("PersonalCost");
