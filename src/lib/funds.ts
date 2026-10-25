import type { Transaction } from "../types";

/**
 * «پول‌ها»: persistent pots of money. Each tagged income adds to a pot.
 * An expense can say which pot paid for it (`fund`); that pot's remaining amount goes down.
 * Funds are NOT tied to months — they persist across all time.
 */
export interface Fund {
  label: string;
  total: number; // Rial in (all incomes with this tag)
  spent: number; // Rial out (expenses paid from this pot)
  remaining: number;
}

/** All pots across all transactions. */
export function allFunds(transactions: Transaction[]): Fund[] {
  const m = new Map<string, Fund>();
  for (const t of transactions) {
    if (t.type !== "income" || !t.tag) continue;
    const f = m.get(t.tag) ?? { label: t.tag, total: 0, spent: 0, remaining: 0 };
    f.total += t.amount;
    m.set(t.tag, f);
  }
  for (const t of transactions) {
    if (t.type !== "expense" || !t.fund) continue;
    const f = m.get(t.fund);
    if (f) f.spent += t.amount;
  }
  return [...m.values()].map((f) => ({ ...f, remaining: f.total - f.spent })).sort((a, b) => b.total - a.total);
}

/** Pots an expense can be paid from: all available funds with positive remaining. */
export function fundOptionsFor(transactions: Transaction[]): string[] {
  return allFunds(transactions).filter((f) => f.remaining > 0).map((f) => f.label);
}

export function fundDisplay(label: string): string {
  return label;
}