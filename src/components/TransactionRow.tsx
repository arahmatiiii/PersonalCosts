import { ArrowDownLeft, Banknote, Tag as TagIcon } from "lucide-react";
import { formatTime } from "../lib/format";
import { fundDisplay } from "../lib/funds";
import type { Bank, Tag, Transaction } from "../types";
import Amount from "./Amount";

interface Props {
  tx: Transaction;
  bank: Bank | undefined;
  tags: Tag[];
  onOpen: () => void;
  showDate?: boolean;
}

export default function TransactionRow({ tx, bank, tags, onOpen, showDate }: Props) {
  const tag = tx.tag ? tags.find((t) => t.label === tx.tag) : undefined;
  const bankName = tx.bankId === "cash" ? "نقدی" : (bank?.name ?? "بانک");
  const d = new Date(tx.timestamp);
  const when = showDate ? d.toLocaleDateString("fa-IR", { day: "numeric", month: "short" }) : formatTime(d);
  const title = tx.tag ?? (tx.note || bankName);
  const sub = [tx.tag ? bankName : null, tx.fund ? `از ${fundDisplay(tx.fund)}` : null, when].filter(Boolean).join(" · ");
  const color = tag?.color ?? (tx.type === "income" ? "var(--income)" : "var(--muted)");

  return (
    <button type="button" className="tx" onClick={onOpen}>
      <div className="tx-icon" style={{ "--c": color } as React.CSSProperties}>
        {tx.tag ? <TagIcon size={19} /> : tx.type === "income" ? <ArrowDownLeft size={20} /> : <Banknote size={20} />}
      </div>
      <div className="grow">
        <div className="tx-title">
          {title}
          {!tx.tagged && <span className="dot" style={{ background: "var(--primary)" }} title="بدون تگ" />}
          {tx.typeUncertain && <span className="dot warn" title="نوع نامطمئن" />}
        </div>
        <div className="tx-sub">{sub}</div>
      </div>
      <Amount rial={tx.amount} type={tx.type} className="tx-amount" />
    </button>
  );
}
