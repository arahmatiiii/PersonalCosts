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
 * Some banks send two different SMS for one expense — e.g. a «مسدودی»/purchase notice and then the
 * actual «کسر», sometimes the next day. Same bank, same amount, within this window, but a different
 * message *format* = the same expense told twice.
 */
export const TWIN_WINDOW_MS = 48 * 60 * 60 * 1000;

/** The SMS with every number removed: two messages of one bank with the same template look alike. */
export function template(text: string): string {
  return normalizeText(text)
    .replace(/[\d,+\-/:*.]+/g, "#")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * An earlier SMS transaction this one repeats (see TWIN_WINDOW_MS). Two SMS with the same template are
 * two real purchases of the same price, never twins; a transaction already merged once is never reused.
 */
export function findTwin(tx: Transaction, existing: Transaction[]): Transaction | undefined {
  const t = template(tx.rawText);
  return existing.find(
    (e) =>
      e.source === "sms" &&
      e.bankId === tx.bankId &&
      e.amount === tx.amount &&
      !e.mergedText &&
      (e.type === tx.type || e.typeUncertain || tx.typeUncertain) &&
      Math.abs(e.timestamp - tx.timestamp) <= TWIN_WINDOW_MS &&
      template(e.rawText) !== t,
  );
}

/** A transaction an SMS was folded into, and what changed on it. */
export interface Merge {
  txId: string;
  captureId?: string;
  patch: Partial<Transaction>;
}

export interface ReadResult {
  added: Transaction[];
  unread: UnreadSms[];
  /** SMS that were the second message of an expense already recorded. */
  merges: Merge[];
  /** Captures that became nothing (duplicate, OTP, unknown sender, unreadable). */
  dropped: string[];
}

function mergePatch(into: Transaction, tx: Transaction): Partial<Transaction> {
  const patch: Partial<Transaction> = { mergedText: tx.rawText, mergedCaptureId: tx.captureId };
  // The later SMS knows the type better when the first one was a guess.
  if (into.typeUncertain && !tx.typeUncertain && !into.tagged) Object.assign(patch, { type: tx.type, typeUncertain: false });
  return patch;
}

/** Adds `tx` unless it's a duplicate or the twin of one already recorded (then it's merged in). */
function place(tx: Transaction, existing: Transaction[], out: ReadResult, captureId: string): void {
  if (isDuplicate(tx, [...existing, ...out.added])) {
    out.dropped.push(captureId);
    return;
  }
  const twinNew = findTwin(tx, out.added);
  if (twinNew) {
    Object.assign(twinNew, mergePatch(twinNew, tx));
    return;
  }
  const twin = findTwin(tx, existing.filter((e) => !out.merges.some((m) => m.txId === e.id)));
  if (twin) {
    out.merges.push({ txId: twin.id, captureId: tx.captureId, patch: mergePatch(twin, tx) });
    return;
  }
  out.added.push(tx);
}

/**
 * Captures from known banks become transactions; those we couldn't read are returned as `unread` so
 * the user can teach a rule from them. Unknown senders and OTPs are dropped.
 */
export function readCaptures(captures: Capture[], banks: Bank[], existing: Transaction[], now = Date.now()): ReadResult {
  const out: ReadResult = { added: [], unread: [], merges: [], dropped: [] };
  for (const c of [...captures].sort((a, b) => a.ts - b.ts)) {
    const bank = bankForSender(banks, c.sender);
    if (!bank) {
      out.dropped.push(c.id);
      continue;
    }
    const tx = smsToTransaction(bank, c.text, c.ts, now);
    if (!tx) {
      if (!isCode(c.text)) out.unread.push({ id: c.id, bankId: bank.id, text: c.text, ts: c.ts });
      out.dropped.push(c.id);
      continue;
    }
    tx.captureId = c.id;
    place(tx, existing, out, c.id);
  }
  return out;
}

export function ingestCaptures(captures: Capture[], banks: Bank[], existing: Transaction[], now = Date.now()): Transaction[] {
  return readCaptures(captures, banks, existing, now).added;
}

/** Retry unread SMS (e.g. after a new rule): returns the new transactions, merges and the ids now read. */
export function rereadUnread(unread: UnreadSms[], banks: Bank[], existing: Transaction[], now = Date.now()): { added: Transaction[]; merges: Merge[]; readIds: string[] } {
  const out: ReadResult = { added: [], unread: [], merges: [], dropped: [] };
  const readIds: string[] = [];
  for (const u of [...unread].sort((a, b) => a.ts - b.ts)) {
    const bank = banks.find((b) => b.id === u.bankId);
    const tx = bank && smsToTransaction(bank, u.text, u.ts, now);
    if (!tx) continue;
    tx.captureId = u.id;
    readIds.push(u.id);
    place(tx, existing, out, u.id);
  }
  return { added: out.added, merges: out.merges, readIds };
}
