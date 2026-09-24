import { Wallet } from "lucide-react";
import type { Fund } from "../lib/funds";
import type { Tag } from "../types";
import Amount from "./Amount";

export default function FundCards({ funds, tags }: { funds: Fund[]; tags: Tag[] }) {
  if (funds.length === 0) return null;
  return (
    <div className="funds">
      {funds.map((f) => {
        const color = tags.find((t) => t.label === f.label)?.color ?? "var(--primary)";
        const pct = f.total ? Math.min(100, (f.spent / f.total) * 100) : 0;
        return (
          <div key={f.label} className="card fund" style={{ "--c": color } as React.CSSProperties}>
            <div className="row">
              <span className="fund-icon">
                <Wallet size={16} />
              </span>
              <span className="grow fund-name">{f.label}</span>
            </div>
            <Amount rial={f.remaining} className={`fund-left${f.remaining < 0 ? " expense" : ""}`} />
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className="muted small">
              {Math.round(pct).toLocaleString("fa-IR")}٪ خرج شده از <Amount rial={f.total} />
            </span>
          </div>
        );
      })}
    </div>
  );
}
