import { formatToman, startOfDay } from "../lib/format";
import { fundsForMonth } from "../lib/funds";
import { readCaptures } from "../lib/ingest";
import { monthOf, monthRange, MONTHS } from "../lib/jalali";
import type { Transaction } from "../types";
import { useStore } from "../store/useStore";
import { isNative, PersonalCost, type WidgetData } from "./personalCost";

export function widgetData(transactions: Transaction[], now = new Date()): WidgetData {
  const month = monthOf(now);
  const [from, to] = monthRange(month);
  const today = startOfDay(now).getTime();
  let monthSpent = 0;
  let todaySpent = 0;
  for (const t of transactions) {
    if (t.type !== "expense" || t.timestamp < from || t.timestamp > to) continue;
    monthSpent += t.amount;
    if (t.timestamp >= today) todaySpent += t.amount;
  }
  const funds = fundsForMonth(transactions, month);
  return {
    title: `خرج ${MONTHS[month.jm - 1]}`,
    month: formatToman(monthSpent),
    today: formatToman(todaySpent),
    funds: funds.length ? formatToman(funds.reduce((s, f) => s + f.remaining, 0)) : "",
    untagged: transactions.filter((t) => !t.tagged).length,
  };
}

let draining = false;

/** Pull natively queued SMS, turn them into transactions, then ack them. */
export async function drainCaptures(): Promise<void> {
  if (!isNative || draining) return;
  draining = true;
  try {
    const { captures } = await PersonalCost.getCaptures();
    if (captures.length === 0) return;
    const s = useStore.getState();
    const { added, unread } = readCaptures(captures, s.banks, s.transactions);
    s.addTransactions(added);
    s.addUnread(unread);
    // Ack only after the (persisted) store has them, so nothing is lost on a crash.
    await PersonalCost.ackCaptures({ ids: captures.map((c) => c.id) });
  } catch (e) {
    console.warn("drainCaptures failed", e);
  } finally {
    draining = false;
  }
}

/** Keeps native in step with the store (senders, reminder, untagged count) and pulls new SMS. */
export function startNativeBridge(): () => void {
  if (!isNative) return () => {};

  let lastSenders = "";
  let lastReminder = "";
  let lastCount = -1;
  let lastWidget = "";

  const push = () => {
    const s = useStore.getState();
    const senders = s.banks.map((b) => b.sender).filter(Boolean);
    const sKey = JSON.stringify(senders);
    if (sKey !== lastSenders) {
      lastSenders = sKey;
      PersonalCost.setSenders({ senders }).catch(console.warn);
    }
    const reminder = { enabled: s.settings.reminderEnabled, hour: s.settings.reminderHour, minute: s.settings.reminderMinute };
    const rKey = JSON.stringify(reminder);
    if (rKey !== lastReminder) {
      lastReminder = rKey;
      PersonalCost.setReminder(reminder).catch(console.warn);
    }
    const count = s.transactions.filter((t) => !t.tagged).length;
    if (count !== lastCount) {
      lastCount = count;
      PersonalCost.setUntaggedCount({ count }).catch(console.warn);
    }
    const widget = widgetData(s.transactions);
    const wKey = JSON.stringify(widget);
    if (wKey !== lastWidget) {
      lastWidget = wKey;
      PersonalCost.setWidget(widget).catch(console.warn);
    }
  };

  push();
  const unsub = useStore.subscribe(push);
  // On resume: pull new SMS, and refresh the widget (e.g. "today" after midnight).
  const onVisible = () => {
    if (document.visibilityState !== "visible") return;
    drainCaptures();
    push();
  };
  document.addEventListener("visibilitychange", onVisible);
  const listener = PersonalCost.addListener("capture", () => drainCaptures());
  drainCaptures();

  return () => {
    unsub();
    document.removeEventListener("visibilitychange", onVisible);
    listener.then((h) => h.remove());
  };
}
