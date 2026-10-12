import type { Transaction } from "../types";
import { addMonths, monthKey, monthOf, monthRange, MONTHS, type JMonth } from "./jalali";

/**
 * «پول‌ها»: every tagged income is a pot of money for its Jalali month (e.g. «حقوق مهر»).
 * An expense can say which pot paid for it (`fund` + `fundMonth`); that pot's remaining amount goes
 * down. The pot may be from a different month than the expense — e.g. a late-Shahrivar purchase paid
 * from Mehr's salary.
 */
export interface Fund {
  label: string;
  total: number; // Rial in
  spent: number; // Rial out (expenses paid from this pot, whatever their own date)
  remaining: number;
}

export interface FundRef {
  label: string;
  month: JMonth;
  key: string; // monthKey(month)
}

/** Which month's pot an expense was paid from (older data has no fundMonth: its own month). */
export function fundMonthOf(t: Pick<Transaction, "timestamp" | "fundMonth">): string {
  return t.fundMonth ?? monthKey(monthOf(t.timestamp));
}

export function fundsForMonth(transactions: Transaction[], month: JMonth): Fund[] {
  const [from, to] = monthRange(month);
  const key = monthKey(month);
  const m = new Map<string, Fund>();
  for (const t of transactions) {
    if (t.type !== "income" || !t.tag || t.timestamp < from || t.timestamp > to) continue;
    const f = m.get(t.tag) ?? { label: t.tag, total: 0, spent: 0, remaining: 0 };
    f.total += t.amount;
    m.set(t.tag, f);
  }
  for (const t of transactions) {
    if (t.type !== "expense" || !t.fund || fundMonthOf(t) !== key) continue;
    const f = m.get(t.fund);
    if (f) f.spent += t.amount;
  }
  return [...m.values()].map((f) => ({ ...f, remaining: f.total - f.spent })).sort((a, b) => b.total - a.total);
}

/** Pots an expense can be paid from: its own month first, then the nearest months (±2). */
export function fundOptionsFor(tx: Pick<Transaction, "timestamp">, transactions: Transaction[], span = 2): FundRef[] {
  const base = monthOf(tx.timestamp);
  const offsets = [0];
  for (let i = 1; i <= span; i++) offsets.push(i, -i);
  return offsets.flatMap((o) => {
    const month = addMonths(base, o);
    return fundsForMonth(transactions, month).map((f) => ({ label: f.label, month, key: monthKey(month) }));
  });
}

export function fundDisplay(label: string, fundKey: string, txTimestamp: number): string {
  if (fundKey === monthKey(monthOf(txTimestamp))) return label;
  const jm = Number(fundKey.split("-")[1]);
  return `${label} ${MONTHS[jm - 1]}`;
}
