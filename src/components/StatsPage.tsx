import { useMemo, useState } from "react";
import { endOfDay, fromDateInput, startOfDay, startOfPersianMonth, startOfWeek, toDateInput } from "../lib/format";
import { useStore } from "../store/useStore";
import type { TxType } from "../types";
import Amount from "./Amount";

type Range = "week" | "month" | "custom";
const UNTAGGED = "بدون تگ";

export default function StatsPage() {
  const { transactions, tags } = useStore();
  const [range, setRange] = useState<Range>("week");
  const [customFrom, setCustomFrom] = useState(toDateInput(startOfWeek(new Date())));
  const [customTo, setCustomTo] = useState(toDateInput(new Date()));
  const [kind, setKind] = useState<TxType>("expense");

  const [from, to] = useMemo(() => {
    const now = new Date();
    if (range === "week") return [startOfWeek(now), endOfDay(now)];
    if (range === "month") return [startOfPersianMonth(now), endOfDay(now)];
    return [startOfDay(fromDateInput(customFrom)), endOfDay(fromDateInput(customTo))];
  }, [range, customFrom, customTo]);

  const { income, expense, buckets } = useMemo(() => {
    let income = 0;
    let expense = 0;
    const m = new Map<string, number>();
    for (const t of transactions) {
      if (t.timestamp < from.getTime() || t.timestamp > to.getTime()) continue;
      if (t.type === "income") income += t.amount;
      else expense += t.amount;
      if (t.type === kind) m.set(t.tag ?? UNTAGGED, (m.get(t.tag ?? UNTAGGED) ?? 0) + t.amount);
    }
    const buckets = [...m.entries()]
      .map(([label, amount]) => ({ label, amount, color: tags.find((t) => t.label === label)?.color ?? "#94a3b8" }))
      .sort((a, b) => b.amount - a.amount);
    return { income, expense, buckets };
  }, [transactions, tags, from, to, kind]);

  const max = buckets[0]?.amount ?? 1;
  const total = buckets.reduce((s, b) => s + b.amount, 0) || 1;
  const net = income - expense;

  return (
    <>
      <h1 className="page-title">آمار</h1>
      <div className="seg">
        {(["week", "month", "custom"] as Range[]).map((r) => (
          <button key={r} type="button" className={range === r ? "on" : ""} onClick={() => setRange(r)}>
            {{ week: "هفته", month: "ماه", custom: "دلخواه" }[r]}
          </button>
        ))}
      </div>
      {range === "custom" && (
        <div className="row">
          <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
          <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
        </div>
      )}

      <div className="card summary">
        <div>
          <div className="muted small">خالص</div>
          <Amount rial={net} type={net >= 0 ? "income" : "expense"} className="net" />
        </div>
        <div className="split">
          <div>
            <span className="muted small">درآمد</span>
            <Amount rial={income} className="income" />
          </div>
          <div>
            <span className="muted small">هزینه</span>
            <Amount rial={expense} className="expense" />
          </div>
        </div>
      </div>

      <div className="seg">
        <button type="button" className={kind === "expense" ? "on expense" : ""} onClick={() => setKind("expense")}>
          هزینه‌ها
        </button>
        <button type="button" className={kind === "income" ? "on income" : ""} onClick={() => setKind("income")}>
          درآمدها
        </button>
      </div>

      {buckets.length === 0 ? (
        <div className="empty">داده‌ای در این بازه نیست</div>
      ) : (
        <div className="card bars">
          {buckets.map((b) => (
            <div key={b.label} className="bar-row">
              <div className="row">
                <span className="dot" style={{ background: b.color }} />
                <span className="grow">{b.label}</span>
                <span className="muted small num">{Math.round((b.amount / total) * 100).toLocaleString("fa-IR")}٪</span>
                <Amount rial={b.amount} />
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(b.amount / max) * 100}%`, background: b.color }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
