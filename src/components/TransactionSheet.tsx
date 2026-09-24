import { AlertTriangle, Trash2, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { autoFund, fundLabelsFor } from "../lib/funds";
import { useStore } from "../store/useStore";
import type { Transaction, TxType } from "../types";
import Amount from "./Amount";
import Sheet from "./Sheet";
import TagChips from "./TagChips";
import TypeToggle from "./TypeToggle";

export default function TransactionSheet({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const { tags, banks, transactions, updateTransaction, deleteTransaction } = useStore();
  const [type, setType] = useState<TxType>(tx.type);
  const [tag, setTag] = useState<string | null>(tx.tag);
  const [fund, setFund] = useState<string | null>(tx.fund ?? null);
  const [fundTouched, setFundTouched] = useState(false);
  const [note, setNote] = useState(tx.note ?? "");
  const bank = tx.bankId === "cash" ? "نقدی" : (banks.find((b) => b.id === tx.bankId)?.name ?? "بانک");
  const funds = useMemo(() => fundLabelsFor(tx, transactions.filter((t) => t.id !== tx.id)), [tx, transactions]);

  function pickTag(l: string) {
    const next = tag === l ? null : l;
    setTag(next);
    // Picking a tag that is also a «پول» this month pays from it, unless a pot was chosen by hand.
    if (!fundTouched && type === "expense") setFund(autoFund({ ...tx, type, fund: null }, next, transactions));
  }

  function save() {
    updateTransaction(tx.id, {
      type,
      tag,
      fund: type === "expense" ? fund : null,
      note: note.trim() || null,
      tagged: tag !== null,
      typeUncertain: false,
    });
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
      <TypeToggle value={type} onChange={setType} />
      <TagChips tags={tags} value={tag} onPick={pickTag} />
      {type === "expense" && funds.length > 0 && (
        <div className="fund-pick">
          <span className="fund-pick-label">
            <Wallet size={16} /> از
          </span>
          <div className="chips">
            {funds.map((f) => (
              <button
                key={f}
                type="button"
                className={`chip outline${fund === f ? " on" : ""}`}
                onClick={() => {
                  setFundTouched(true);
                  setFund((cur) => (cur === f ? null : f));
                }}
              >
                {f}
              </button>
            ))}
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
          if (confirm("حذف شود؟")) {
            deleteTransaction(tx.id);
            onClose();
          }
        }}
      >
        <Trash2 size={16} /> حذف
      </button>
    </Sheet>
  );
}
