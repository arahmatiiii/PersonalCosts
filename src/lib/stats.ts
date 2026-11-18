import type { FundTransfer, Tag, Transaction } from "../types";
import { faNum, startOfDay } from "./format";
import { addMonths, fromJalali, MONTHS, monthLabel, monthLength, monthOf, monthRange, toJalali } from "./jalali";

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
  movedIn: number; // moved here from other pots during the range
  movedOut: number; // moved to other pots during the range
}

/**
 * What happened to each «پول» in the period: incomes with that tag dated in it, and expenses paid from it.
 */
export function fundsInRange(transactions: Transaction[], from: number, to: number, transfers: FundTransfer[] = []): RangeFund[] {
  const m = new Map<string, RangeFund>();
  const get = (label: string) => m.get(label) ?? m.set(label, { label, income: 0, spent: 0, movedIn: 0, movedOut: 0 }).get(label)!;
  for (const t of transactions) {
    if (t.type === "income" && t.tag && t.timestamp >= from && t.timestamp <= to) get(t.tag).income += t.amount;
    else if (t.type === "expense" && t.fund && t.timestamp >= from && t.timestamp <= to) get(t.fund).spent += t.amount;
  }
  for (const x of transfers) {
    if (x.timestamp < from || x.timestamp > to) continue;
    get(x.from).movedOut += x.amount;
    get(x.to).movedIn += x.amount;
  }
  return [...m.values()].sort((a, b) => b.income + b.spent - (a.income + a.spent));
}

export interface RangeFundDetail extends RangeFund {
  incomes: Transaction[];
  expenses: Transaction[]; // newest first
  transfers: FundTransfer[]; // in or out of this pot, newest first
  /** Running balance (income − spent) after each event in the range, oldest first. */
  flow: { t: number; balance: number }[];
  perDay: number;
  /** Days of the range still ahead (0 when the range is over). */
  daysLeft: number;
}

export function fundInRange(transactions: Transaction[], label: string, from: number, to: number, now = Date.now(), allTransfers: FundTransfer[] = []): RangeFundDetail {
  const incomes = transactions.filter((t) => t.type === "income" && t.tag === label && t.timestamp >= from && t.timestamp <= to).sort((a, b) => b.timestamp - a.timestamp);
  const expenses = transactions.filter((t) => t.type === "expense" && t.fund === label && t.timestamp >= from && t.timestamp <= to).sort((a, b) => b.timestamp - a.timestamp);
  const transfers = allTransfers.filter((x) => (x.from === label || x.to === label) && x.timestamp >= from && x.timestamp <= to).sort((a, b) => b.timestamp - a.timestamp);
  const movedIn = transfers.filter((x) => x.to === label).reduce((s, x) => s + x.amount, 0);
  const movedOut = transfers.filter((x) => x.from === label).reduce((s, x) => s + x.amount, 0);
  const events = [
    ...incomes.map((t) => ({ t: t.timestamp, d: t.amount })),
    ...expenses.map((t) => ({ t: t.timestamp, d: -t.amount })),
    ...transfers.map((x) => ({ t: x.timestamp, d: x.to === label ? x.amount : -x.amount })),
  ].sort((a, b) => a.t - b.t);
  let balance = 0;
  const flow = events.map((e) => ({ t: e.t, balance: (balance += e.d) }));
  const income = incomes.reduce((s, t) => s + t.amount, 0);
  const spent = expenses.reduce((s, t) => s + t.amount, 0);
  return {
    label,
    income,
    spent,
    movedIn,
    movedOut,
    incomes,
    expenses,
    transfers,
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

/** The same Jalali day one month earlier (clamped to that month's length), at local midnight. */
export function monthBefore(ts: number, n = -1): number {
  const { jy, jm, jd } = toJalali(new Date(ts));
  const p = addMonths({ jy, jm }, n);
  return fromJalali(p.jy, p.jm, Math.min(jd, monthLength(p.jy, p.jm))).getTime();
}

/**
 * Spending so far in the current period vs the same stretch of the period before (for the home hero).
 * The period starts at `periodStart` (the salary day) or, without one, on the 1st of this month.
 */
export function paceVsLastMonth(transactions: Transaction[], now = new Date(), periodStart: number | null = null): number | null {
  const month = monthOf(now);
  const from = periodStart ?? monthRange(month)[0];
  const pFrom = periodStart !== null ? monthBefore(periodStart) : monthRange(addMonths(month, -1))[0];
  const pTo = from - 1;
  const elapsed = now.getTime() - from;
  const spentNow = transactions.filter((t) => t.type === "expense" && t.timestamp >= from && t.timestamp <= now.getTime()).reduce((s, t) => s + t.amount, 0);
  const spentThen = transactions.filter((t) => t.type === "expense" && t.timestamp >= pFrom && t.timestamp <= Math.min(pTo, pFrom + elapsed)).reduce((s, t) => s + t.amount, 0);
  if (spentThen <= 0) return null;
  return spentNow / spentThen - 1;
}
/** «۱۵ آبان» */
export function jDayLabel(ts: number): string {
  const j = toJalali(new Date(ts));
  return `${faNum(j.jd)} ${MONTHS[j.jm - 1]}`;
}

export interface HomePeriod {
  from: number;
  to: number;
  /** Since the salary day (true) or the calendar month (false). */
  salary: boolean;
  /** «خرج از ۱۵ آبان» / «خرج آبان ۱۴۰۵» */
  title: string;
  /** «این دوره» / «این ماه» */
  short: string;
}

/** Home, the widget and Stats' default: from the last salary day if set (and not in the future), else this month. */
export function homePeriod(salaryDate: number | null, now = new Date()): HomePeriod {
  if (salaryDate !== null && salaryDate <= now.getTime()) {
    // Until the day before next month's payday; if that has passed (date not updated yet), until today.
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    const to = Math.max(monthBefore(salaryDate, 1) - 1, end.getTime());
    return { from: salaryDate, to, salary: true, title: `خرج از ${jDayLabel(salaryDate)}`, short: "این دوره" };
  }
  const month = monthOf(now);
  const [from, to] = monthRange(month);
  return { from, to, salary: false, title: `خرج ${monthLabel(month)}`, short: "این ماه" };
}
