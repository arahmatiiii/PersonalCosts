import { Inbox, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { dayKey, faNum, formatDay, rialToToman, startOfDay } from "../lib/format";
import { useStore } from "../store/useStore";
import type { Transaction } from "../types";
import AddSheet from "./AddSheet";
import TransactionRow from "./TransactionRow";
import TransactionSheet from "./TransactionSheet";

const PAGE_DAYS = 7;

export default function HomePage() {
  const { transactions, banks, tags } = useStore();
  const [daysBack, setDaysBack] = useState(PAGE_DAYS - 1);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const bankById = useMemo(() => new Map(banks.map((b) => [b.id, b])), [banks]);
  const sorted = useMemo(() => [...transactions].sort((a, b) => b.timestamp - a.timestamp), [transactions]);
  const from = useMemo(() => {
    const f = startOfDay(new Date());
    f.setDate(f.getDate() - daysBack);
    return f.getTime();
  }, [daysBack]);

  const untagged = sorted.filter((t) => !t.tagged);
  const olderUntagged = untagged.filter((t) => t.timestamp < from);
  const hasOlder = sorted.some((t) => t.timestamp < from && t.tagged);

  const groups = useMemo(() => {
    const m = new Map<string, { date: Date; items: Transaction[] }>();
    for (const t of sorted) {
      if (t.timestamp < from) break;
      const d = new Date(t.timestamp);
      const k = dayKey(d);
      if (!m.has(k)) m.set(k, { date: d, items: [] });
      m.get(k)!.items.push(t);
    }
    return [...m.values()];
  }, [sorted, from]);

  const todayStart = startOfDay(new Date()).getTime();
  const today = sorted.filter((t) => t.timestamp >= todayStart);
  const todayExpense = today.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const open = openId ? transactions.find((t) => t.id === openId) : undefined;

  const group = (title: string, items: Transaction[]) => (
    <section key={title}>
      <div className="day-title">{title}</div>
      <div className="card tx-group">
        {items.map((t) => (
          <TransactionRow key={t.id} tx={t} bank={bankById.get(t.bankId)} tags={tags} onOpen={() => setOpenId(t.id)} />
        ))}
      </div>
    </section>
  );

  return (
    <>
      <div className="hero">
        <span className="label">هزینه امروز</span>
        <span className="value num">
          {faNum(rialToToman(todayExpense))}
          <small>تومان</small>
        </span>
        <div className="meta">
          <span className="pill">{faNum(today.length)} تراکنش</span>
          {untagged.length > 0 && <span className="pill">{faNum(untagged.length)} بدون تگ</span>}
        </div>
      </div>

      {olderUntagged.length > 0 && group("بدون تگ", olderUntagged)}
      {groups.map((g) => group(formatDay(g.date), g.items))}

      {groups.length === 0 && olderUntagged.length === 0 && (
        <div className="empty">
          <Inbox size={36} strokeWidth={1.5} />
          <span>هنوز تراکنشی نیست</span>
        </div>
      )}
      {hasOlder && (
        <button type="button" className="link-btn" onClick={() => setDaysBack((d) => d + PAGE_DAYS)}>
          روزهای قبل
        </button>
      )}

      <button type="button" className="fab" onClick={() => setAdding(true)} aria-label="افزودن">
        <Plus size={26} />
      </button>
      {adding && <AddSheet onClose={() => setAdding(false)} />}
      {open && <TransactionSheet key={open.id} tx={open} onClose={() => setOpenId(null)} />}
    </>
  );
}
