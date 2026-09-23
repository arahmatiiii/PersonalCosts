import { ingestCaptures } from "../lib/ingest";
import { useStore } from "../store/useStore";
import { isNative, PersonalCost } from "./personalCost";

let draining = false;

/** Pull natively queued captures, parse them into transactions, then ack them. */
export async function drainCaptures(): Promise<void> {
  if (!isNative || draining) return;
  draining = true;
  try {
    const { captures } = await PersonalCost.getCaptures();
    if (captures.length === 0) return;
    const s = useStore.getState();
    const { added, log } = ingestCaptures(captures, s.banks, s.transactions);
    s.addTransactions(added);
    s.appendDebug(log);
    // Ack only after the store (persisted to localStorage) has them, so nothing is lost on a crash.
    await PersonalCost.ackCaptures({ ids: captures.map((c) => c.id) });
  } catch (e) {
    console.warn("drainCaptures failed", e);
  } finally {
    draining = false;
  }
}

/**
 * Keeps the native side in step with the store (bank filters, reminder time, untagged count) and
 * pulls in new captures when they arrive or when the app comes to the foreground.
 * Returns an unsubscribe function; a no-op on the web.
 */
export function startNativeBridge(): () => void {
  if (!isNative) return () => {};

  let lastFilters = "";
  let lastReminder = "";
  let lastCount = -1;

  const push = () => {
    const s = useStore.getState();
    const enabled = s.banks.filter((b) => b.enabled);
    const filters = {
      packages: enabled.flatMap((b) => b.matchPackages).filter(Boolean),
      senders: enabled.flatMap((b) => b.matchSenderIds).filter(Boolean),
      captureAll: s.captureAll,
    };
    const fKey = JSON.stringify(filters);
    if (fKey !== lastFilters) {
      lastFilters = fKey;
      PersonalCost.setFilters(filters).catch(console.warn);
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
  };

  push();
  const unsubStore = useStore.subscribe(push);
  const onVisible = () => document.visibilityState === "visible" && drainCaptures();
  document.addEventListener("visibilitychange", onVisible);
  const listener = PersonalCost.addListener("capture", () => drainCaptures());
  drainCaptures();

  return () => {
    unsubStore();
    document.removeEventListener("visibilitychange", onVisible);
    listener.then((h) => h.remove());
  };
}
