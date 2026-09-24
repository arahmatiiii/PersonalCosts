import { startOfDay } from "../lib/format";
import type { Transaction } from "../types";

const DAY = ["ی", "د", "س", "چ", "پ", "ج", "ش"]; // Sun..Sat

/** Tiny 7-day spending chart for the hero card. */
export default function WeekBars({ transactions }: { transactions: Transaction[] }) {
  const today = startOfDay(new Date());
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    const from = d.getTime();
    const to = from + 86_400_000;
    const total = transactions.filter((t) => t.type === "expense" && t.timestamp >= from && t.timestamp < to).reduce((s, t) => s + t.amount, 0);
    return { d, total };
  });
  const max = Math.max(...days.map((x) => x.total), 1);
  return (
    <div className="week">
      {days.map(({ d, total }, i) => (
        <div key={i} className={`week-col${i === 6 ? " today" : ""}`}>
          <div className="week-bar">
            <div style={{ height: `${Math.max(6, (total / max) * 100)}%`, opacity: total ? 1 : 0.35 }} />
          </div>
          <span>{DAY[d.getDay()]}</span>
        </div>
      ))}
    </div>
  );
}
