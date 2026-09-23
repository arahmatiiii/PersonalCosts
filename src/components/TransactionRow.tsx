import { useState } from "react";
import { formatRelative, formatTime, formatToman } from "../lib/format";
import { useStore } from "../store/useStore";
import type { Bank, Tag, Transaction, TxType } from "../types";
import TagPicker from "./TagPicker";
import TypeToggle from "./TypeToggle";

interface Props {
  tx: Transaction;
  bank: Bank | undefined;
  tags: Tag[];
  tagColor: (label: string | null) => string;
}

const SOURCE_LABEL = { sms: "پیامک", notification: "اعلان", manual: "دستی" } as const;

export default function TransactionRow({ tx, bank, tags, tagColor }: Props) {
  const updateTransaction = useStore((s) => s.updateTransaction);
  const deleteTransaction = useStore((s) => s.deleteTransaction);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(tx.note ?? "");
  const [type, setType] = useState<TxType>(tx.type);
  const [showRaw, setShowRaw] = useState(false);
  const date = new Date(tx.timestamp);
  const isOpen = editing || !tx.tagged;

  function pick(label: string) {
    updateTransaction(tx.id, { tag: label, note: note.trim() || null, type, tagged: true, typeUncertain: false });
    setEditing(false);
  }

  const classes = ["tx", tx.tagged ? "tx-tagged" : "tx-untagged", tx.typeUncertain ? "tx-uncertain" : ""].join(" ");

  return (
    <li className={classes}>
      <div className="tx-head" onClick={() => tx.tagged && setEditing((e) => !e)}>
        <div className={`tx-amount ${tx.type}`}>
          {tx.type === "income" ? "+" : "−"}
          {formatToman(tx.amount)}
        </div>
        <div className="tx-meta">
          <span>{tx.bankId === "cash" ? "نقدی" : (bank?.name ?? "بانک نامشخص")}</span>
          <span className="muted" title={date.toLocaleString("fa-IR")}>
            {formatTime(date)} · {formatRelative(date)} · {SOURCE_LABEL[tx.source]}
          </span>
        </div>
        {tx.tagged && !editing && (
          <div className="tx-tag">
            <span className="chip chip-active chip-sm" style={{ "--chip": tagColor(tx.tag) } as React.CSSProperties}>
              {tx.tag}
            </span>
            {tx.note && <span className="muted small ellipsis">{tx.note}</span>}
          </div>
        )}
      </div>

      {tx.typeUncertain && (
        <div className="warn small">⚠️ نوع تراکنش (هزینه/درآمد) به‌طور خودکار تشخیص داده نشد — لطفاً بررسی کنید.</div>
      )}

      {isOpen && (
        <div className="tx-edit">
          <div className="row">
            <TypeToggle value={type} onChange={setType} />
            <input className="grow" placeholder="یادداشت (اختیاری)" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <TagPicker tags={tags} value={tx.tag} onPick={pick} />
          <div className="row small">
            {tx.rawText && (
              <button type="button" className="link" onClick={() => setShowRaw((s) => !s)}>
                {showRaw ? "پنهان کردن متن اصلی" : "نمایش متن اصلی"}
              </button>
            )}
            <span className="grow" />
            {tx.tagged && (
              <button type="button" className="link" onClick={() => setEditing(false)}>
                بستن
              </button>
            )}
            <button type="button" className="link danger" onClick={() => confirm("این تراکنش حذف شود؟") && deleteTransaction(tx.id)}>
              حذف
            </button>
          </div>
          {showRaw && <pre className="raw">{tx.rawText}</pre>}
        </div>
      )}
    </li>
  );
}
