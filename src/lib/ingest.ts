import type { Bank, DebugEntry, Transaction } from "../types";
import { newId } from "./id";
import { bankMatches, parse } from "./parser";

/** A raw SMS/notification captured by the native Android side. */
export interface Capture {
  id: string;
  source: "sms" | "notification";
  origin: string; // package name or SMS sender
  text: string;
  ts: number;
}

export const DEDUP_WINDOW_MS = 2 * 60 * 1000;
export const UNCLEAR_TYPE_NOTE = "auto: type unclear, please verify";

/**
 * Banks often send both an SMS and an app notification for one transaction, and apps re-post
 * notifications on update. A capture is a duplicate if within 2 minutes there's already one for the
 * same bank + amount with the identical raw text, or from the other channel (their texts differ).
 */
export function isDuplicate(tx: Pick<Transaction, "bankId" | "amount" | "rawText" | "source" | "timestamp">, existing: Transaction[]): boolean {
  return existing.some(
    (e) =>
      e.source !== "manual" &&
      e.bankId === tx.bankId &&
      e.amount === tx.amount &&
      Math.abs(e.timestamp - tx.timestamp) <= DEDUP_WINDOW_MS &&
      (e.rawText === tx.rawText || e.source !== tx.source),
  );
}

export interface IngestResult {
  added: Transaction[];
  log: DebugEntry[];
}

export function ingestCaptures(captures: Capture[], banks: Bank[], existing: Transaction[], now = Date.now()): IngestResult {
  const added: Transaction[] = [];
  const log: DebugEntry[] = [];
  const enabled = banks.filter((b) => b.enabled);

  for (const c of [...captures].sort((a, b) => a.ts - b.ts)) {
    const entry = (status: string) => log.push({ t: c.ts, status, origin: c.origin, text: c.text });
    const candidates = enabled.filter((b) => bankMatches(b, c.source, c.origin));
    if (candidates.length === 0) {
      // Only reaches here in "capture all" debug mode — useful for finding package names/senders.
      entry(c.source === "sms" ? "SMS (no bank)" : "NOTIF (no bank)");
      continue;
    }
    const failures: string[] = [];
    let done = false;
    for (const bank of candidates) {
      const out = parse(bank, c.text);
      if (!out.ok) {
        failures.push(`${bank.name}: ${out.error}`);
        continue;
      }
      const tx: Transaction = {
        id: newId(),
        amount: out.result.amount,
        type: out.result.type,
        bankId: bank.id,
        timestamp: c.ts,
        rawText: c.text,
        source: c.source,
        tag: null,
        note: out.result.typeUncertain ? UNCLEAR_TYPE_NOTE : null,
        tagged: false,
        typeUncertain: out.result.typeUncertain,
        createdAt: now,
      };
      if (isDuplicate(tx, [...existing, ...added])) {
        entry(`DUPLICATE ${bank.name}: ${tx.amount}`);
      } else {
        added.push(tx);
        entry(`SAVED ${bank.name}: ${tx.amount} ${tx.type}${tx.typeUncertain ? " (uncertain)" : ""}`);
      }
      done = true;
      break;
    }
    if (!done) entry(`UNPARSED — ${failures.join("; ")}`);
  }
  return { added, log };
}
