import { useMemo, useState } from "react";
import StatsChart, { type TagBucket } from "../components/StatsChart";
import { useTags } from "../hooks/useTags";
import { useTransactions } from "../hooks/useTransactions";
import { endOfDay, formatToman, fromDateInput, startOfDay, toDateInput } from "../lib/format";

type Range = "week" | "month" | "custom";

/** Iranian week starts on Saturday. */
function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const diff = (x.getDay() + 1) % 7; // Sat=0 … Fri=6
  x.setDate(x.getDate() - diff);
  return x;
}

/** "This month" = the current Solar Hijri (Persian calendar) month. */
function startOfPersianMonth(d: Date) {
  const dayOfMonth = Number(
    new Intl.DateTimeFormat("en-US-u-ca-persian", { day: "numeric" }).format(d).replace(/\D/g, ""),
  );
  const x = startOfDay(d);
  x.setDate(x.getDate() - (dayOfMonth - 1));
  return x;
}

const UNTAGGED = "بدون تگ";

export default function Stats() {
  const [range, setRange] = useState<Range>("week");
  const [customFrom, setCustomFrom] = useState(toDateInput(startOfWeek(new Date())));
  const [customTo, setCustomTo] = useState(toDateInput(new Date()));
  const [kind, setKind] = useState<"expense" | "income">("expense");

  const [from, to] = useMemo(() => {
    const now = new Date();
    if (range === "week") return [startOfWeek(now), endOfDay(now)];
    if (range === "month") return [startOfPersianMonth(now), endOfDay(now)];
    return [startOfDay(fromDateInput(customFrom)), endOfDay(fromDateInput(customTo))];
  }, [range, customFrom, customTo]);

  const { data: txs, loading, error } = useTransactions(from, to);
  const { byLabel } = useTags();

  const { income, expense, buckets, uncertain } = useMemo(() => {
    let income = 0;
    let expense = 0;
    let uncertain = 0;
    const m = new Map<string, number>();
    for (const t of txs) {
      if (t.type === "income") income += t.amount;
      else expense += t.amount;
      if (t.typeUncertain) uncertain++;
      if (t.type === kind) {
        const k = t.tag ?? UNTAGGED;
        m.set(k, (m.get(k) ?? 0) + t.amount);
      }
    }
    const buckets: TagBucket[] = [...m.entries()]
      .map(([label, amount]) => ({ label, amount, color: byLabel.get(label)?.color ?? "#94a3b8" }))
      .sort((a, b) => b.amount - a.amount);
    return { income, expense, buckets, uncertain };
  }, [txs, kind, byLabel]);

  return (
    <div className="page stack">
      <div className="segmented wide">
        {(["week", "month", "custom"] as Range[]).map((r) => (
          <button key={r} type="button" className={range === r ? "on" : ""} onClick={() => setRange(r)}>
            {{ week: "این هفته", month: "این ماه", custom: "بازه دلخواه" }[r]}
          </button>
        ))}
      </div>
      {range === "custom" && (
        <div className="row">
          <label className="grow">
            از
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
          </label>
          <label className="grow">
            تا
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </label>
        </div>
      )}
      <p className="muted small center">
        {from.toLocaleDateString("fa-IR")} تا {to.toLocaleDateString("fa-IR")}
      </p>
      {error && <p className="error">{error.message}</p>}

      <div className="totals">
        <div className="card">
          <div className="muted small">درآمد</div>
          <div className="income">{formatToman(income)}</div>
        </div>
        <div className="card">
          <div className="muted small">هزینه</div>
          <div className="expense">{formatToman(expense)}</div>
        </div>
        <div className="card">
          <div className="muted small">خالص</div>
          <div className={income - expense >= 0 ? "income" : "expense"}>{formatToman(income - expense)}</div>
        </div>
      </div>
      {uncertain > 0 && (
        <p className="warn small">
          {uncertain.toLocaleString("fa-IR")} تراکنش در این بازه نوع نامطمئن دارد و ممکن است آمار را منحرف کند — از داشبورد بررسی
          کنید.
        </p>
      )}

      <section className="card stack">
        <div className="row">
          <h2 className="grow">تفکیک بر اساس تگ</h2>
          <div className="segmented">
            <button type="button" className={kind === "expense" ? "on expense" : ""} onClick={() => setKind("expense")}>
              هزینه
            </button>
            <button type="button" className={kind === "income" ? "on income" : ""} onClick={() => setKind("income")}>
              درآمد
            </button>
          </div>
        </div>
        {loading ? <p className="muted">در حال بارگذاری…</p> : <StatsChart data={buckets} />}
        <ul className="list">
          {buckets.map((b) => (
            <li key={b.label} className="list-row">
              <span className="dot" style={{ background: b.color }} />
              <span className="grow">{b.label}</span>
              <span>{formatToman(b.amount)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
