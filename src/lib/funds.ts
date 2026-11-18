import type { FundTransfer, Transaction } from "../types";

/**
 * «پول‌ها»: persistent pots of money. Each tagged income adds to a pot.
 * An expense can say which pot paid for it (`fund`); that pot's remaining amount goes down.
 * Money can also be moved between pots (FundTransfer) — that's neither income nor expense.
 * Funds are NOT tied to months — they persist across all time.
 */
export interface Fund {
  label: string;
  total: number; // Rial in (all incomes with this tag)
  spent: number; // Rial out (expenses paid from this pot)
  movedIn: number; // Rial moved here from other pots
  movedOut: number; // Rial moved from here to other pots
  remaining: number;
}

/** All pots across all transactions and transfers. */
export function allFunds(transactions: Transaction[], transfers: FundTransfer[] = []): Fund[] {
  const m = new Map<string, Fund>();
  const get = (label: string) => m.get(label) ?? m.set(label, { label, total: 0, spent: 0, movedIn: 0, movedOut: 0, remaining: 0 }).get(label)!;
  for (const t of transactions) if (t.type === "income" && t.tag) get(t.tag).total += t.amount;
  for (const x of transfers) {
    get(x.from).movedOut += x.amount;
    get(x.to).movedIn += x.amount;
  }
  for (const t of transactions) {
    if (t.type !== "expense" || !t.fund) continue;
    const f = m.get(t.fund);
    if (f) f.spent += t.amount;
  }
  return [...m.values()]
    .map((f) => ({ ...f, remaining: f.total + f.movedIn - f.spent - f.movedOut }))
    .sort((a, b) => b.total + b.movedIn - (a.total + a.movedIn));
}

/** Pots an expense can be paid from: all available funds with positive remaining. */
export function fundOptionsFor(transactions: Transaction[], transfers: FundTransfer[] = []): string[] {
  return allFunds(transactions, transfers).filter((f) => f.remaining > 0).map((f) => f.label);
}

export function fundDisplay(label: string): string {
  return label;
}
