import { AlertTriangle, Trash2, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { fundDisplay, fundMonthOf, fundOptionsFor } from "../lib/funds";
import { useStore } from "../store/useStore";
import type { Transaction, TxType } from "../types";
import { haptic } from "../lib/haptic";
import Amount from "./Amount";
import Sheet from "./Sheet";
import TagChips from "./TagChips";
import TypeToggle from "./TypeToggle";

export default function TransactionSheet({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const { tags, banks, transactions, updateTransaction, deleteTransaction, addTransactions, showToast } = useStore();
  const [type, setType] = useState<TxType>(tx.type);
  const [tag, setTag] = useState<string | null>(tx.tag);
  // Selected pot as "label|monthKey", or null.
  const [fund, setFund] = useState<string | null>(tx.fund ? `${tx.fund}|${fundMonthOf(tx)}` : null);
  const [note, setNote] = useState(tx.note ?? "");
  const bank = tx.bankId === "cash" ? "نقدی" : (banks.find((b) => b.id === tx.bankId)?.name ?? "بانک");
  const funds = useMemo(() => fundOptionsFor(tx, transactions.filter((t) => t.id !== tx.id)), [tx, transactions]);

  const kindTags = tags.filter((t) => t.kind === (type === "income" ? "fund" : "expense"));

  function changeType(next: TxType) {
    setType(next);
    // expense tags and «پول» tags are separate lists
    if (tag && !tags.some((t) => t.label === tag && t.kind === (next === "income" ? "fund" : "expense"))) setTag(null);
  }

  function save() {
    updateTransaction(tx.id, {
      type,
      tag,
      fund: type === "expense" && fund ? fund.split("|")[0] : null,
      fundMonth: type === "expense" && fund ? fund.split("|")[1] : null,
      note: note.trim() || null,
      tagged: tag !== null,
      typeUncertain: false,
    });
    haptic();
    onClose();
  }

  return (
    <Sheet title={bank} onClose={onClose}>
      <div className="sheet-amount">
        <Amount rial={tx.amount} type={type} />
        <div className="muted small">{new Date(tx.timestamp).toLocaleString("fa-IR", { dateStyle: "full", timeStyle: "short" })}</div>
      </div>
      {tx.typeUncertain && (
        <div className="warn-box">
          <AlertTriangle size={16} /> نوع تراکنش را بررسی کنید
        </div>
      )}
      <TypeToggle value={type} onChange={changeType} />
      <span className="field-label">{type === "income" ? "این درآمد کدام پول است؟" : "تگ هزینه"}</span>
      <TagChips tags={kindTags} value={tag} onPick={(l) => setTag((cur) => (cur === l ? null : l))} />
      {kindTags.length === 0 && <span className="muted small">در تنظیمات یک {type === "income" ? "تگ پول" : "تگ هزینه"} بساز.</span>}
      {type === "expense" && funds.length > 0 && (
        <div className="fund-pick">
          <span className="fund-pick-label">
            <Wallet size={16} /> از
          </span>
          <div className="chips">
            {funds.map((f) => {
              const id = `${f.label}|${f.key}`;
              return (
                <button
                  key={id}
                  type="button"
                  className={`chip outline${fund === id ? " on" : ""}`}
                  onClick={() => setFund((cur) => (cur === id ? null : id))}
                >
                  {fundDisplay(f.label, f.key, tx.timestamp)}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <input placeholder="یادداشت" value={note} onChange={(e) => setNote(e.target.value)} />
      {tx.rawText && <pre className="raw">{tx.rawText}</pre>}
      <button type="button" className="btn btn-primary btn-block" onClick={save}>
        ذخیره
      </button>
      <button
        type="button"
        className="danger-btn"
        onClick={() => {
          deleteTransaction(tx.id);
          showToast("تراکنش حذف شد", () => addTransactions([tx]));
          onClose();
        }}
      >
        <Trash2 size={16} /> حذف
      </button>
    </Sheet>
  );
}
