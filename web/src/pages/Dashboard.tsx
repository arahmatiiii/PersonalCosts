import { useMemo, useState } from "react";
import TransactionForm from "../components/TransactionForm";
import TransactionRow from "../components/TransactionRow";
import { useBanks } from "../hooks/useBanks";
import { useTags } from "../hooks/useTags";
import { useTransactions, useUntaggedTransactions } from "../hooks/useTransactions";
import { dayKey, endOfDay, formatDay, formatToman, startOfDay, tsToDate } from "../lib/format";
import type { Transaction } from "../types";

const PAGE_DAYS = 7;

export default function Dashboard() {
  const [daysBack, setDaysBack] = useState(0); // 0 = today only
  const [adding, setAdding] = useState(false);

  const [from, to] = useMemo(() => {
    const f = startOfDay(new Date());
    f.setDate(f.getDate() - daysBack);
    return [f, endOfDay(new Date())];
  }, [daysBack]);

  const { data: txs, loading, error, fromCache } = useTransactions(from, to);
  const { data: untagged } = useUntaggedTransactions();
  const { data: banks, byId } = useBanks();
  const { data: tags, byLabel } = useTags();
  const tagColor = (l: string | null) => (l && byLabel.get(l)?.color) || "#94a3b8";

  // Untagged transactions older than the visible window — shown on top so nothing escapes review.
  const olderUntagged = useMemo(
    () =>
      untagged
        .filter((t) => tsToDate(t.timestamp) < from)
        .sort((a, b) => tsToDate(b.timestamp).getTime() - tsToDate(a.timestamp).getTime()),
    [untagged, from],
  );

  const groups = useMemo(() => {
    const m = new Map<string, { date: Date; items: Transaction[] }>();
    for (const t of txs) {
      const d = tsToDate(t.timestamp);
      const k = dayKey(d);
      if (!m.has(k)) m.set(k, { date: d, items: [] });
      m.get(k)!.items.push(t);
    }
    return [...m.values()];
  }, [txs]);

  const today = groups.find((g) => dayKey(g.date) === dayKey(new Date()));
  const todayExpense = (today?.items ?? []).filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  const row = (t: Transaction) => (
    <TransactionRow key={t.id} tx={t} bank={byId.get(t.bankId)} tags={tags} tagColor={tagColor} />
  );

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
      {fromCache && <p className="muted small center">آفلاین — نمایش آخرین داده همگام‌شده</p>}
      {error && <p className="error">{error.message}</p>}

      {olderUntagged.length > 0 && (
        <section>
          <h2 className="day">تگ‌نخورده‌های قبلی</h2>
          <ul className="tx-list">{olderUntagged.map(row)}</ul>
        </section>
      )}

      {!loading && groups.length === 0 && <p className="muted center">امروز تراکنشی ثبت نشده.</p>}
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
      {adding && <TransactionForm banks={banks} tags={tags} onClose={() => setAdding(false)} />}
    </div>
  );
}
