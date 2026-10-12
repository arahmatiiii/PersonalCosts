import type { Bank, Transaction, UnreadSms } from "../types";
import { newId } from "./id";
import { normalizeSender, normalizeText, parse } from "./parser";
import { applyRules } from "./smsRules";

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

/** The bank's learned rules first, then the generic parser. */
export function smsToTransaction(bank: Bank, text: string, ts: number, now = Date.now()): Transaction | null {
  const r = applyRules(text, bank.rules) ?? parse(text);
  if (!r) return null;
  return {
    id: newId(),
    amount: r.amount,
    type: r.type,
    bankId: bank.id,
    timestamp: ts,
    rawText: text,
    source: "sms",
    tag: null,
    note: null,
    tagged: false,
    typeUncertain: r.typeUncertain,
    createdAt: now,
  };
}

/** OTPs and verification codes are never transactions — not worth keeping as unread. */
const isCode = (text: string) => {
  const n = normalizeText(text);
  return /رمز|کد تایید|کد فعال/.test(n) && !/مبلغ/.test(n);
};

/**
 * Captures from known banks become transactions; those we couldn't read are returned as `unread` so
 * the user can teach a rule from them. Unknown senders and OTPs are dropped.
 */
export function readCaptures(captures: Capture[], banks: Bank[], existing: Transaction[], now = Date.now()): { added: Transaction[]; unread: UnreadSms[] } {
  const added: Transaction[] = [];
  const unread: UnreadSms[] = [];
  for (const c of [...captures].sort((a, b) => a.ts - b.ts)) {
    const bank = bankForSender(banks, c.sender);
    if (!bank) continue;
    const tx = smsToTransaction(bank, c.text, c.ts, now);
    if (!tx) {
      if (!isCode(c.text)) unread.push({ id: c.id, bankId: bank.id, text: c.text, ts: c.ts });
      continue;
    }
    if (!isDuplicate(tx, [...existing, ...added])) added.push(tx);
  }
  return { added, unread };
}

export function ingestCaptures(captures: Capture[], banks: Bank[], existing: Transaction[], now = Date.now()): Transaction[] {
  return readCaptures(captures, banks, existing, now).added;
}

/** Retry unread SMS (e.g. after a new rule): returns the new transactions and the ids now read. */
export function rereadUnread(unread: UnreadSms[], banks: Bank[], existing: Transaction[], now = Date.now()): { added: Transaction[]; readIds: string[] } {
  const added: Transaction[] = [];
  const readIds: string[] = [];
  for (const u of unread) {
    const bank = banks.find((b) => b.id === u.bankId);
    const tx = bank && smsToTransaction(bank, u.text, u.ts, now);
    if (!tx) continue;
    readIds.push(u.id);
    if (!isDuplicate(tx, [...existing, ...added])) added.push(tx);
  }
  return { added, readIds };
}
