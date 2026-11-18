import { formatToman, startOfDay } from "../lib/format";
import { allFunds } from "../lib/funds";
import { readCaptures } from "../lib/ingest";
import { homePeriod } from "../lib/stats";
import type { FundTransfer, Tag, Transaction } from "../types";
import { useStore } from "../store/useStore";
import { isNative, PersonalCost, type TagChoice, type TagOptions, type WidgetData } from "./personalCost";

export function widgetData(transactions: Transaction[], salaryDate: number | null = null, transfers: FundTransfer[] = [], now = new Date()): WidgetData {
  const period = homePeriod(salaryDate, now);
  const today = startOfDay(now).getTime();
  let periodSpent = 0;
  let todaySpent = 0;
  for (const t of transactions) {
    if (t.type !== "expense" || t.timestamp < period.from || t.timestamp > period.to) continue;
    periodSpent += t.amount;
    if (t.timestamp >= today) todaySpent += t.amount;
  }
  const funds = allFunds(transactions, transfers);
  return {
    title: period.title,
    month: formatToman(periodSpent),
    today: formatToman(todaySpent),
    funds: funds.length ? formatToman(funds.reduce((s, f) => s + f.remaining, 0)) : "",
    untagged: transactions.filter((t) => !t.tagged).length,
  };
}

/** Notification buttons: tags ordered by how often they were used. */
export function tagOptions(transactions: Transaction[], tags: Tag[], transfers: FundTransfer[], enabled: boolean): TagOptions {
  const uses = new Map<string, number>();
  for (const t of transactions) if (t.tag) uses.set(`${t.type}:${t.tag}`, (uses.get(`${t.type}:${t.tag}`) ?? 0) + 1);
  const ordered = (kind: Tag["kind"], type: Transaction["type"]) =>
    tags
      .filter((t) => t.kind === kind)
      .map((t, i) => ({ label: t.label, n: uses.get(`${type}:${t.label}`) ?? 0, i }))
      .sort((a, b) => b.n - a.n || a.i - b.i)
      .map((t) => t.label);
  return {
    enabled,
    expense: ordered("expense", "expense"),
    income: ordered("fund", "income"),
    payFrom: allFunds(transactions, transfers)
      .filter((f) => f.remaining > 0)
      .map((f) => f.label),
  };
}

const byCapture = (transactions: Transaction[], captureId: string) => transactions.find((t) => t.captureId === captureId || t.mergedCaptureId === captureId);

/** Apply tags picked on SMS notifications. Choices whose SMS became no transaction are dropped. */
export function applyTagChoices(choices: TagChoice[]): void {
  const s = useStore.getState();
  for (const c of choices) {
    const tx = byCapture(useStore.getState().transactions, c.captureId);
    if (!tx || tx.tagged) continue;
    const kind = c.kind === "income" ? "fund" : "expense";
    if (!s.tags.some((t) => t.label === c.tag && t.kind === kind)) continue;
    // The user read the SMS on the notification and picked the kind of tag: trust it over the parser.
    if (tx.type !== c.kind) s.updateTransaction(tx.id, { type: c.kind });
    s.tagTransaction(tx.id, c.tag, c.kind === "expense" ? { fund: c.fund || null } : { fund: null });
  }
}

let draining = false;
let again = false;

/** Pull natively queued SMS, turn them into transactions, then ack them; then apply notification tags. */
export async function drainCaptures(): Promise<void> {
  if (!isNative) return;
  if (draining) {
    again = true; // an SMS or a notification tap arrived mid-drain: run once more afterwards
    return;
  }
  draining = true;
  again = false;
  try {
    const { captures } = await PersonalCost.getCaptures();
    if (captures.length) {
      const s = useStore.getState();
      const { added, unread, merges, dropped } = readCaptures(captures, s.banks, s.transactions);
      s.addTransactions(added);
      s.applyMerges(merges);
      s.addUnread(unread);
      // Ack only after the (persisted) store has them, so nothing is lost on a crash.
      await PersonalCost.ackCaptures({ ids: captures.map((c) => c.id) });
      // No transaction to tag (unreadable / duplicate / OTP), or merged into one already tagged.
      const tagged = new Set(useStore.getState().transactions.filter((t) => t.tagged).map((t) => t.id));
      const gone = [...dropped, ...merges.filter((m) => tagged.has(m.txId) && m.captureId).map((m) => m.captureId!)];
      if (gone.length) PersonalCost.cancelTagPrompts({ captureIds: gone }).catch(console.warn);
    }
    const { choices } = await PersonalCost.getTagChoices();
    if (choices.length) {
      applyTagChoices(choices);
      await PersonalCost.ackTagChoices({ ids: choices.map((c) => c.id) });
    }
  } catch (e) {
    console.warn("drainCaptures failed", e);
  } finally {
    draining = false;
    if (again) drainCaptures();
  }
}

/** Keeps native in step with the store (senders, reminder, untagged count, tag buttons) and pulls new SMS. */
export function startNativeBridge(): () => void {
  if (!isNative) return () => {};

  let lastSenders = "";
  let lastReminder = "";
  let lastCount = -1;
  let lastWidget = "";
  let lastOptions = "";
  let waiting = new Set<string>(); // capture ids of untagged SMS transactions

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
    const widget = widgetData(s.transactions, s.settings.salaryDate, s.transfers);
    const wKey = JSON.stringify(widget);
    if (wKey !== lastWidget) {
      lastWidget = wKey;
      PersonalCost.setWidget(widget).catch(console.warn);
    }
    const options = tagOptions(s.transactions, s.tags, s.transfers, s.settings.tagNotify);
    const oKey = JSON.stringify(options);
    if (oKey !== lastOptions) {
      lastOptions = oKey;
      PersonalCost.setTagOptions(options).catch(console.warn);
    }
    // Tagged (or deleted) in the app: its notification is no longer needed.
    const now = new Set(s.transactions.filter((t) => !t.tagged).flatMap((t) => [t.captureId, t.mergedCaptureId].filter((x): x is string => !!x)));
    const done = [...waiting].filter((id) => !now.has(id));
    waiting = now;
    if (done.length) PersonalCost.cancelTagPrompts({ captureIds: done }).catch(console.warn);
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
  const listeners = [PersonalCost.addListener("capture", () => drainCaptures()), PersonalCost.addListener("tagChoice", () => drainCaptures())];
  drainCaptures();

  return () => {
    unsub();
    document.removeEventListener("visibilitychange", onVisible);
    listeners.forEach((l) => l.then((h) => h.remove()));
  };
}
