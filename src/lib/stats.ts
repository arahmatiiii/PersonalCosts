import type { Tag, Transaction } from "../types";
import { startOfDay } from "./format";
import { fundMonthOf } from "./funds";
import { addMonths, monthKey, monthOf, monthRange, type JMonth } from "./jalali";

const DAY = 86_400_000;
export const UNTAGGED = "بدون تگ";

export interface TagSlice {
  label: string;
  amount: number;
  color: string;
}

export function tagBreakdown(expenses: Transaction[], tags: Tag[]): TagSlice[] {
  const m = new Map<string, number>();
  for (const t of expenses) m.set(t.tag ?? UNTAGGED, (m.get(t.tag ?? UNTAGGED) ?? 0) + t.amount);
  return [...m.entries()]
    .map(([label, amount]) => ({ label, amount, color: tags.find((t) => t.label === label && t.kind === "expense")?.color ?? "#94a3b8" }))
    .sort((a, b) => b.amount - a.amount);
}

/** Calendar days in [from, to] up to `now` (at least 1). */
export function daysIn(from: number, to: number, now = Date.now()): number {
  return Math.max(1, Math.ceil((Math.min(now, to) - from) / DAY));
}

export interface RangeFund {
  label: string;
  income: number; // came into this «پول» during the range
  spent: number; // paid from it during the range
}

/**
 * Whether expense `t` counts against a pot for this period. For a month (`potMonth`) that's the
 * month's pot itself — expenses paid from it whatever their own date, like the Home cards; for any
 * other range it's expenses dated inside the range.
 */
function paidInPeriod(t: Transaction, from: number, to: number, potMonth?: JMonth): boolean {
  return potMonth ? fundMonthOf(t) === monthKey(potMonth) : t.timestamp >= from && t.timestamp <= to;
}

/** What happened to each «پول» in the period: incomes with that tag dated in it, and expenses paid from it. */
export function fundsInRange(transactions: Transaction[], from: number, to: number, potMonth?: JMonth): RangeFund[] {
  const m = new Map<string, RangeFund>();
  const get = (label: string) => m.get(label) ?? m.set(label, { label, income: 0, spent: 0 }).get(label)!;
  for (const t of transactions) {
    if (t.type === "income" && t.tag && t.timestamp >= from && t.timestamp <= to) get(t.tag).income += t.amount;
    else if (t.type === "expense" && t.fund && paidInPeriod(t, from, to, potMonth)) get(t.fund).spent += t.amount;
  }
  return [...m.values()].sort((a, b) => b.income + b.spent - (a.income + a.spent));
}

export interface RangeFundDetail extends RangeFund {
  incomes: Transaction[];
  expenses: Transaction[]; // newest first
  /** Running balance (income − spent) after each event in the range, oldest first. */
  flow: { t: number; balance: number }[];
  perDay: number;
  /** Days of the range still ahead (0 when the range is over). */
  daysLeft: number;
}

export function fundInRange(transactions: Transaction[], label: string, from: number, to: number, potMonth?: JMonth, now = Date.now()): RangeFundDetail {
  const incomes = transactions.filter((t) => t.type === "income" && t.tag === label && t.timestamp >= from && t.timestamp <= to).sort((a, b) => b.timestamp - a.timestamp);
  const expenses = transactions.filter((t) => t.type === "expense" && t.fund === label && paidInPeriod(t, from, to, potMonth)).sort((a, b) => b.timestamp - a.timestamp);
  const events = [...incomes.map((t) => ({ t: t.timestamp, d: t.amount })), ...expenses.map((t) => ({ t: t.timestamp, d: -t.amount }))].sort((a, b) => a.t - b.t);
  let balance = 0;
  const flow = events.map((e) => ({ t: e.t, balance: (balance += e.d) }));
  const income = incomes.reduce((s, t) => s + t.amount, 0);
  const spent = expenses.reduce((s, t) => s + t.amount, 0);
  return {
    label,
    income,
    spent,
    incomes,
    expenses,
    flow,
    perDay: spent / daysIn(from, to, now),
    daysLeft: now >= from && now <= to ? Math.max(0, Math.ceil((to - now) / DAY)) : 0,
  };
}

/** Expenses dated in [from, to] that no «پول» paid for. */
export function unfundedExpenses(transactions: Transaction[], from: number, to: number): Transaction[] {
  return transactions.filter((t) => t.type === "expense" && !t.fund && t.timestamp >= from && t.timestamp <= to).sort((a, b) => b.timestamp - a.timestamp);
}

/** Expense per day for every day in [from, to], keyed by local midnight. */
export function dailyExpense(transactions: Transaction[], from: number, to: number): Map<number, number> {
  const m = new Map<number, number>();
  for (const t of transactions) {
    if (t.type !== "expense" || t.timestamp < from || t.timestamp > to) continue;
    const d = startOfDay(new Date(t.timestamp)).getTime();
    m.set(d, (m.get(d) ?? 0) + t.amount);
  }
  return m;
}

/** Spending up to the same day-of-month in this month vs the month before (for the home hero). */
export function paceVsLastMonth(transactions: Transaction[], now = new Date()): number | null {
  const month = monthOf(now);
  const [from] = monthRange(month);
  const [pFrom, pTo] = monthRange(addMonths(month, -1));
  const elapsed = now.getTime() - from;
  const spentNow = transactions.filter((t) => t.type === "expense" && t.timestamp >= from && t.timestamp <= now.getTime()).reduce((s, t) => s + t.amount, 0);
  const spentThen = transactions.filter((t) => t.type === "expense" && t.timestamp >= pFrom && t.timestamp <= Math.min(pTo, pFrom + elapsed)).reduce((s, t) => s + t.amount, 0);
  if (spentThen <= 0) return null;
  return spentNow / spentThen - 1;
}
