import { Banknote, Tag as TagIcon } from "lucide-react";
import { formatTime } from "../lib/format";
import { useStore } from "../store/useStore";
import type { Bank, Tag, Transaction } from "../types";
import Amount from "./Amount";
import TagChips from "./TagChips";

interface Props {
  tx: Transaction;
  bank: Bank | undefined;
  tags: Tag[];
  onOpen: () => void;
}

export default function TransactionRow({ tx, bank, tags, onOpen }: Props) {
  const updateTransaction = useStore((s) => s.updateTransaction);
  const tag = tx.tag ? tags.find((t) => t.label === tx.tag) : undefined;
  const bankName = tx.bankId === "cash" ? "نقدی" : (bank?.name ?? "بانک");
  const title = tx.tag ?? (tx.note || bankName);
  const sub = [tx.tag ? bankName : null, formatTime(new Date(tx.timestamp)), tx.tag && tx.note ? tx.note : null].filter(Boolean).join(" · ");

  return (
    <div className="tx" onClick={onOpen}>
      <div className="tx-main">
        <div className="tx-icon" style={{ "--c": tag?.color ?? "var(--muted)" } as React.CSSProperties}>
          {tx.tag ? <TagIcon size={19} /> : <Banknote size={20} />}
        </div>
        <div className="grow">
          <div className="tx-title row" style={{ gap: 6 }}>
            {title}
            {tx.typeUncertain && <span className="dot warn" title="نوع نامطمئن" />}
          </div>
          <div className="tx-sub">{sub}</div>
        </div>
        <Amount rial={tx.amount} type={tx.type} className="tx-amount" />
      </div>
      {!tx.tagged && (
        <TagChips tags={tags} value={null} scroll onPick={(label) => updateTransaction(tx.id, { tag: label, tagged: true, typeUncertain: false })} />
      )}
    </div>
  );
}
