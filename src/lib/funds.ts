import type { Transaction } from "../types";
import { monthOf, monthRange, type JMonth } from "./jalali";

/**
 * «پول‌ها»: every tagged income is a pot of money for its Jalali month (e.g. «حقوق»).
 * An expense can say which pot it was paid from (`fund`); the pot's remaining amount for that month
 * goes down accordingly.
 */
export interface Fund {
  label: string;
  total: number; // Rial in
  spent: number; // Rial out (expenses with fund === label in the same month)
  remaining: number;
}

export function fundsForMonth(transactions: Transaction[], month: JMonth): Fund[] {
  const [from, to] = monthRange(month);
  const m = new Map<string, Fund>();
  for (const t of transactions) {
    if (t.type !== "income" || !t.tag || t.timestamp < from || t.timestamp > to) continue;
    const f = m.get(t.tag) ?? { label: t.tag, total: 0, spent: 0, remaining: 0 };
    f.total += t.amount;
    m.set(t.tag, f);
  }
  for (const t of transactions) {
    if (t.type !== "expense" || !t.fund || t.timestamp < from || t.timestamp > to) continue;
    const f = m.get(t.fund);
    if (f) f.spent += t.amount;
  }
  return [...m.values()].map((f) => ({ ...f, remaining: f.total - f.spent })).sort((a, b) => b.total - a.total);
}

/** Labels of the pots available to an expense (tagged incomes in its month). */
export function fundLabelsFor(tx: Pick<Transaction, "timestamp">, transactions: Transaction[]): string[] {
  return fundsForMonth(transactions, monthOf(tx.timestamp)).map((f) => f.label);
}

/**
 * When an expense gets tag `tag`: if a pot with the same name exists that month, pay from it
 * automatically (unless a pot was already chosen by hand).
 */
export function autoFund(tx: Transaction, tag: string | null, transactions: Transaction[]): string | null {
  if (tx.type !== "expense") return null;
  if (tx.fund) return tx.fund;
  if (tag && fundLabelsFor(tx, transactions).includes(tag)) return tag;
  return null;
}
