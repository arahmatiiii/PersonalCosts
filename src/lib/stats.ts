import type { Tag, Transaction } from "../types";
import { startOfDay } from "./format";
import { fundMonthOf, fundsForMonth, type Fund } from "./funds";
import { addMonths, monthKey, monthOf, monthRange, sameMonth, type JMonth } from "./jalali";

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
    .map(([label, amount]) => ({ label, amount, color: tags.find((t) => t.label === label)?.color ?? "#94a3b8" }))
    .sort((a, b) => b.amount - a.amount);
}

export interface FundDetail {
  fund: Fund;
  incomes: Transaction[];
  expenses: Transaction[]; // newest first
  /** Remaining balance after each event, oldest first, starting from the first income. */
  burn: { t: number; remaining: number }[];
  perDay: number;
  /** Current-month pots only: when the pot runs out at the current pace (null if it lasts the month). */
  runsOutAt: number | null;
  daysLeftInMonth: number;
}

/**
 * Everything about one «پول»: its incomes, the expenses paid from it (whatever their own date), how
 * its balance went down, and — for the current month — how long it lasts at the current pace.
 */
export function fundDetail(transactions: Transaction[], label: string, month: JMonth, now = Date.now()): FundDetail | null {
  const fund = fundsForMonth(transactions, month).find((f) => f.label === label);
  if (!fund) return null;
  const [from, to] = monthRange(month);
  const key = monthKey(month);
  const incomes = transactions.filter((t) => t.type === "income" && t.tag === label && t.timestamp >= from && t.timestamp <= to);
  const expenses = transactions
    .filter((t) => t.type === "expense" && t.fund === label && fundMonthOf(t) === key)
    .sort((a, b) => b.timestamp - a.timestamp);

  const events = [...incomes.map((t) => ({ t: t.timestamp, d: t.amount })), ...expenses.map((t) => ({ t: t.timestamp, d: -t.amount }))].sort((a, b) => a.t - b.t);
  let remaining = 0;
  const burn = events.map((e) => ({ t: e.t, remaining: (remaining += e.d) }));

  const isCurrent = now >= from && now <= to;
  const elapsedDays = Math.max(1, Math.ceil((Math.min(now, to) - from) / DAY));
  const perDay = fund.spent / elapsedDays;
  const daysLeftInMonth = isCurrent ? Math.max(0, Math.ceil((to - now) / DAY)) : 0;
  let runsOutAt: number | null = null;
  if (isCurrent && perDay > 0) {
    const at = startOfDay(new Date(now)).getTime() + Math.max(0, fund.remaining / perDay) * DAY;
    if (at < to) runsOutAt = at;
  }
  return { fund, incomes, expenses, burn, perDay, runsOutAt, daysLeftInMonth };
}

/** Expenses dated in `month` that no «پول» paid for. */
export function unfundedExpenses(transactions: Transaction[], month: JMonth): Transaction[] {
  const [from, to] = monthRange(month);
  return transactions.filter((t) => t.type === "expense" && !t.fund && t.timestamp >= from && t.timestamp <= to).sort((a, b) => b.timestamp - a.timestamp);
}

export interface MonthTotal {
  month: JMonth;
  income: number;
  expense: number;
}

/** Income / expense of the `count` months ending at `last`, oldest first. */
export function monthlyTotals(transactions: Transaction[], last: JMonth, count: number): MonthTotal[] {
  const months = Array.from({ length: count }, (_, i) => addMonths(last, i - count + 1));
  const idx = new Map(months.map((m, i) => [monthKey(m), i]));
  const out = months.map((month) => ({ month, income: 0, expense: 0 }));
  for (const t of transactions) {
    const i = idx.get(monthKey(monthOf(t.timestamp)));
    if (i === undefined) continue;
    if (t.type === "income") out[i].income += t.amount;
    else out[i].expense += t.amount;
  }
  return out;
}

export function monthsBetween(a: JMonth, b: JMonth): number {
  return b.jy * 12 + b.jm - (a.jy * 12 + a.jm);
}

/** An amount from `monthsAgo` months back, in today's money at `annualRatePct` inflation. */
export function inTodaysMoney(amount: number, monthsAgo: number, annualRatePct: number): number {
  return amount * Math.pow(1 + annualRatePct / 100, monthsAgo / 12);
}

export interface Change {
  nominal: number; // fraction, e.g. 0.25 = +25%
  real: number;
}

/** How `cur` (spent now) compares with `prev` (spent `monthsAgo` months earlier), before and after inflation. */
export function change(cur: number, prev: number, monthsAgo: number, annualRatePct: number): Change | null {
  if (prev <= 0) return null;
  return { nominal: cur / prev - 1, real: cur / inTodaysMoney(prev, monthsAgo, annualRatePct) - 1 };
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

/** Spending up to the same day-of-month in `month` vs the month before (for the home hero). */
export function paceVsLastMonth(transactions: Transaction[], now = new Date()): number | null {
  const month = monthOf(now);
  const [from] = monthRange(month);
  const prev = addMonths(month, -1);
  const [pFrom, pTo] = monthRange(prev);
  const elapsed = now.getTime() - from;
  const spentNow = transactions.filter((t) => t.type === "expense" && t.timestamp >= from && t.timestamp <= now.getTime()).reduce((s, t) => s + t.amount, 0);
  const spentThen = transactions.filter((t) => t.type === "expense" && t.timestamp >= pFrom && t.timestamp <= Math.min(pTo, pFrom + elapsed)).reduce((s, t) => s + t.amount, 0);
  if (spentThen <= 0) return null;
  return spentNow / spentThen - 1;
}

export interface YearSummary {
  income: number;
  expense: number;
  topTag: TagSlice | null;
  topMonth: MonthTotal | null;
  biggest: Transaction | null;
  busiestWeekday: number | null; // 0 = Sunday
  count: number;
}

export function yearSummary(transactions: Transaction[], jy: number, tags: Tag[]): YearSummary {
  const months = monthlyTotals(transactions, { jy, jm: 12 }, 12);
  const [from] = monthRange({ jy, jm: 1 });
  const [, to] = monthRange({ jy, jm: 12 });
  const inYear = transactions.filter((t) => t.timestamp >= from && t.timestamp <= to);
  const expenses = inYear.filter((t) => t.type === "expense");
  const weekday = new Array(7).fill(0);
  for (const t of expenses) weekday[new Date(t.timestamp).getDay()] += t.amount;
  const topMonth = months.reduce<MonthTotal | null>((a, m) => (m.expense > (a?.expense ?? 0) ? m : a), null);
  return {
    income: months.reduce((s, m) => s + m.income, 0),
    expense: months.reduce((s, m) => s + m.expense, 0),
    topTag: tagBreakdown(expenses.filter((t) => t.tag), tags)[0] ?? null,
    topMonth,
    biggest: expenses.reduce<Transaction | null>((a, t) => (t.amount > (a?.amount ?? 0) ? t : a), null),
    busiestWeekday: expenses.length ? weekday.indexOf(Math.max(...weekday)) : null,
    count: inYear.length,
  };
}

export function isCurrentMonth(m: JMonth): boolean {
  return sameMonth(m, monthOf(new Date()));
}
