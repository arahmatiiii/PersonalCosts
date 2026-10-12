import { ChevronLeft, Wallet } from "lucide-react";
import type { Fund } from "../lib/funds";
import type { Tag } from "../types";
import Amount from "./Amount";

export default function FundCards({ funds, tags, onOpen }: { funds: Fund[]; tags: Tag[]; onOpen: (label: string) => void }) {
  if (funds.length === 0) return null;
  return (
    <div className="funds">
      {funds.map((f) => {
        const color = tags.find((t) => t.label === f.label && t.kind === "fund")?.color ?? "var(--primary)";
        const pct = f.total ? Math.min(100, (f.spent / f.total) * 100) : 0;
        return (
          <button key={f.label} type="button" className="card fund" style={{ "--c": color } as React.CSSProperties} onClick={() => onOpen(f.label)}>
            <div className="row">
              <span className="fund-icon">
                <Wallet size={16} />
              </span>
              <span className="grow fund-name">{f.label}</span>
              <ChevronLeft size={16} className="muted" />
            </div>
            <Amount rial={f.remaining} className={`fund-left${f.remaining < 0 ? " expense" : ""}`} />
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className="muted small">
              {Math.round(pct).toLocaleString("fa-IR")}٪ خرج شده از <Amount rial={f.total} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
