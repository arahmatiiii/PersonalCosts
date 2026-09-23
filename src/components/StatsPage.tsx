import { useMemo, useState } from "react";
import { endOfDay, formatToman, fromDateInput, startOfDay, startOfPersianMonth, startOfWeek, toDateInput } from "../lib/format";
import { useStore } from "../store/useStore";
import StatsChart, { type TagBucket } from "./StatsChart";

type Range = "week" | "month" | "custom";
const UNTAGGED = "بدون تگ";

export default function StatsPage() {
  const { transactions, tags } = useStore();
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

  const { income, expense, buckets, uncertain } = useMemo(() => {
    let income = 0;
    let expense = 0;
    let uncertain = 0;
    const m = new Map<string, number>();
    for (const t of transactions) {
      if (t.timestamp < from.getTime() || t.timestamp > to.getTime()) continue;
      if (t.type === "income") income += t.amount;
      else expense += t.amount;
      if (t.typeUncertain) uncertain++;
      if (t.type === kind) m.set(t.tag ?? UNTAGGED, (m.get(t.tag ?? UNTAGGED) ?? 0) + t.amount);
    }
    const buckets: TagBucket[] = [...m.entries()]
      .map(([label, amount]) => ({ label, amount, color: tags.find((t) => t.label === label)?.color ?? "#94a3b8" }))
      .sort((a, b) => b.amount - a.amount);
    return { income, expense, buckets, uncertain };
  }, [transactions, tags, from, to, kind]);

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
          {uncertain.toLocaleString("fa-IR")} تراکنش در این بازه نوع نامطمئن دارد و ممکن است آمار را منحرف کند — از صفحه امروز بررسی کنید.
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
        <StatsChart data={buckets} />
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
