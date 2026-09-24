import { useMemo, useState } from "react";
import { dayKey, formatDay } from "../lib/format";
import { monthKey, monthLabel, monthOf, type JMonth } from "../lib/jalali";
import { useStore } from "../store/useStore";
import type { Transaction } from "../types";
import Amount from "./Amount";
import TransactionRow from "./TransactionRow";
import TransactionSheet from "./TransactionSheet";

const PAGE = 60;

export default function HistoryPage() {
  const { transactions, banks, tags } = useStore();
  const [limit, setLimit] = useState(PAGE);
  const [openId, setOpenId] = useState<string | null>(null);
  const bankById = useMemo(() => new Map(banks.map((b) => [b.id, b])), [banks]);
  const sorted = useMemo(() => [...transactions].sort((a, b) => b.timestamp - a.timestamp), [transactions]);

  // month → day → transactions, with month totals over the whole month (not just the visible page)
  const months = useMemo(() => {
    const totals = new Map<string, { spent: number; income: number }>();
    for (const t of sorted) {
      const k = monthKey(monthOf(t.timestamp));
      const x = totals.get(k) ?? { spent: 0, income: 0 };
      if (t.type === "expense") x.spent += t.amount;
      else x.income += t.amount;
      totals.set(k, x);
    }
    const out: { month: JMonth; key: string; days: { date: Date; items: Transaction[] }[] }[] = [];
    for (const t of sorted.slice(0, limit)) {
      const month = monthOf(t.timestamp);
      const key = monthKey(month);
      let m = out[out.length - 1];
      if (!m || m.key !== key) out.push((m = { month, key, days: [] }));
      const d = new Date(t.timestamp);
      let day = m.days[m.days.length - 1];
      if (!day || dayKey(day.date) !== dayKey(d)) m.days.push((day = { date: d, items: [] }));
      day.items.push(t);
    }
    return out.map((m) => ({ ...m, ...totals.get(m.key)! }));
  }, [sorted, limit]);

  const open = openId ? transactions.find((t) => t.id === openId) : undefined;

  return (
    <>
      <h1 className="page-title">تاریخچه</h1>
      {months.length === 0 && <div className="empty">هنوز تراکنشی نیست</div>}
      {months.map((m) => (
        <section key={m.key} className="stack" style={{ gap: 14 }}>
          <div className="month-head">
            <span>{monthLabel(m.month)}</span>
            <span className="month-totals">
              <Amount rial={m.spent} className="expense" />
              {m.income > 0 && <Amount rial={m.income} className="income" />}
            </span>
          </div>
          {m.days.map((d) => (
            <div key={dayKey(d.date)}>
              <div className="day-title">{formatDay(d.date)}</div>
              <div className="card tx-group">
                {d.items.map((t) => (
                  <TransactionRow key={t.id} tx={t} bank={bankById.get(t.bankId)} tags={tags} onOpen={() => setOpenId(t.id)} />
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
      {sorted.length > limit && (
        <button type="button" className="link-btn" onClick={() => setLimit((l) => l + PAGE)}>
          بیشتر
        </button>
      )}
      {open && <TransactionSheet key={open.id} tx={open} onClose={() => setOpenId(null)} />}
    </>
  );
}
