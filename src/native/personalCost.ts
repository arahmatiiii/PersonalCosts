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

/** What the SMS notification offers as one-tap buttons (most used first). */
export interface TagOptions {
  enabled: boolean;
  /** Expense tags. */
  expense: string[];
  /** «پول» tags, for incomes. */
  income: string[];
  /** «پول»s an expense can be paid from (second step after an expense tag). */
  payFrom: string[];
}

/** A tag picked on the SMS notification, waiting to be applied to that SMS's transaction. */
export interface TagChoice {
  id: string;
  captureId: string;
  tag: string;
  kind: "expense" | "income";
  fund: string | null;
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
  setTagOptions(opts: TagOptions): Promise<void>;
  getTagChoices(): Promise<{ choices: TagChoice[] }>;
  ackTagChoices(opts: { ids: string[] }): Promise<void>;
  /** Remove the SMS notifications of these captures (tagged in the app, unreadable, duplicates…). */
  cancelTagPrompts(opts: { captureIds: string[] }): Promise<void>;
  addListener(event: "capture" | "tagChoice", fn: () => void): Promise<PluginListenerHandle>;
}

export const isNative = Capacitor.isNativePlatform();

export const PersonalCost = registerPlugin<PersonalCostPlugin>("PersonalCost");
