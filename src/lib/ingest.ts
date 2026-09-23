import type { Bank, Transaction } from "../types";
import { newId } from "./id";
import { normalizeSender, parse } from "./parser";

/** A raw SMS captured by the native Android side. */
export interface Capture {
  id: string;
  sender: string;
  text: string;
  ts: number;
}

/** Same bank + amount + text within this window = the same SMS delivered/queued twice. */
export const DEDUP_WINDOW_MS = 2 * 60 * 1000;

export function isDuplicate(tx: Pick<Transaction, "bankId" | "amount" | "rawText" | "timestamp">, existing: Transaction[]): boolean {
  return existing.some(
    (e) =>
      e.source === "sms" &&
      e.bankId === tx.bankId &&
      e.amount === tx.amount &&
      e.rawText === tx.rawText &&
      Math.abs(e.timestamp - tx.timestamp) <= DEDUP_WINDOW_MS,
  );
}

export function bankForSender(banks: Bank[], sender: string): Bank | undefined {
  const s = normalizeSender(sender);
  return banks.find((b) => normalizeSender(b.sender) === s);
}

/** Captures from unknown senders and SMS without an amount (OTP, ads) are dropped. */
export function ingestCaptures(captures: Capture[], banks: Bank[], existing: Transaction[], now = Date.now()): Transaction[] {
  const added: Transaction[] = [];
  for (const c of [...captures].sort((a, b) => a.ts - b.ts)) {
    const bank = bankForSender(banks, c.sender);
    if (!bank) continue;
    const r = parse(c.text);
    if (!r) continue;
    const tx: Transaction = {
      id: newId(),
      amount: r.amount,
      type: r.type,
      bankId: bank.id,
      timestamp: c.ts,
      rawText: c.text,
      source: "sms",
      tag: null,
      note: null,
      tagged: false,
      typeUncertain: r.typeUncertain,
      createdAt: now,
    };
    if (!isDuplicate(tx, [...existing, ...added])) added.push(tx);
  }
  return added;
}
