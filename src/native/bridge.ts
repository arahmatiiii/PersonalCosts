import { ingestCaptures } from "../lib/ingest";
import { useStore } from "../store/useStore";
import { isNative, PersonalCost } from "./personalCost";

let draining = false;

/** Pull natively queued SMS, turn them into transactions, then ack them. */
export async function drainCaptures(): Promise<void> {
  if (!isNative || draining) return;
  draining = true;
  try {
    const { captures } = await PersonalCost.getCaptures();
    if (captures.length === 0) return;
    const s = useStore.getState();
    s.addTransactions(ingestCaptures(captures, s.banks, s.transactions));
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
  };

  push();
  const unsub = useStore.subscribe(push);
  const onVisible = () => document.visibilityState === "visible" && drainCaptures();
  document.addEventListener("visibilitychange", onVisible);
  const listener = PersonalCost.addListener("capture", () => drainCaptures());
  drainCaptures();

  return () => {
    unsub();
    document.removeEventListener("visibilitychange", onVisible);
    listener.then((h) => h.remove());
  };
}
