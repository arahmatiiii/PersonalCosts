import { useMemo, useState } from "react";
import { dayKey, formatDay, formatToman, startOfDay } from "../lib/format";
import { isNative } from "../native/personalCost";
import { useStore } from "../store/useStore";
import type { Transaction } from "../types";
import TransactionForm from "./TransactionForm";
import TransactionRow from "./TransactionRow";

const PAGE_DAYS = 7;

export default function HomePage() {
  const { transactions, banks, tags } = useStore();
  const [daysBack, setDaysBack] = useState(0); // 0 = today only
  const [adding, setAdding] = useState(false);

  const sortedTags = useMemo(() => [...tags].sort((a, b) => a.order - b.order), [tags]);
  const bankById = useMemo(() => new Map(banks.map((b) => [b.id, b])), [banks]);
  const tagColor = (l: string | null) => (l && tags.find((t) => t.label === l)?.color) || "#94a3b8";

  const from = useMemo(() => {
    const f = startOfDay(new Date());
    f.setDate(f.getDate() - daysBack);
    return f.getTime();
  }, [daysBack]);

  const sorted = useMemo(() => [...transactions].sort((a, b) => b.timestamp - a.timestamp), [transactions]);
  const untagged = sorted.filter((t) => !t.tagged);
  // Untagged ones older than the visible window stay pinned on top so nothing escapes review.
  const olderUntagged = untagged.filter((t) => t.timestamp < from);

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
  const todayExpense = sorted.filter((t) => t.timestamp >= todayStart && t.type === "expense").reduce((s, t) => s + t.amount, 0);

  const row = (t: Transaction) => <TransactionRow key={t.id} tx={t} bank={bankById.get(t.bankId)} tags={sortedTags} tagColor={tagColor} />;

  return (
    <div className="page">
      <header className="summary card">
        <div>
          <div className="muted small">هزینه امروز</div>
          <div className="big">{formatToman(todayExpense)}</div>
        </div>
        <div className={untagged.length ? "pill pill-warn" : "pill"}>
          {untagged.length ? `${untagged.length.toLocaleString("fa-IR")} تگ‌نخورده` : "همه تگ خورده ✓"}
        </div>
      </header>

      {!isNative && transactions.length === 0 && (
        <p className="muted small center">
          این نسخه وب است و فقط ثبت دستی دارد. دریافت خودکار پیامک/اعلان بانک در نسخه اندروید (APK) انجام می‌شود.
        </p>
      )}

      {olderUntagged.length > 0 && (
        <section>
          <h2 className="day">تگ‌نخورده‌های قبلی</h2>
          <ul className="tx-list">{olderUntagged.map(row)}</ul>
        </section>
      )}

      {groups.length === 0 && <p className="muted center">امروز تراکنشی ثبت نشده.</p>}
      {groups.map((g) => (
        <section key={dayKey(g.date)}>
          <h2 className="day">{formatDay(g.date)}</h2>
          <ul className="tx-list">{g.items.map(row)}</ul>
        </section>
      ))}

      <button type="button" className="more" onClick={() => setDaysBack((d) => (d === 0 ? PAGE_DAYS : d + PAGE_DAYS))}>
        نمایش روزهای قبل
      </button>

      <button type="button" className="fab" onClick={() => setAdding(true)} aria-label="افزودن تراکنش">
        +
      </button>
      {adding && <TransactionForm banks={banks} tags={sortedTags} onClose={() => setAdding(false)} />}
    </div>
  );
}
