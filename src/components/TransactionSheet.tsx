import { AlertTriangle, Trash2 } from "lucide-react";
import { useState } from "react";
import { useStore } from "../store/useStore";
import type { Transaction, TxType } from "../types";
import Amount from "./Amount";
import Sheet from "./Sheet";
import TagChips from "./TagChips";
import TypeToggle from "./TypeToggle";

export default function TransactionSheet({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const { tags, banks, updateTransaction, deleteTransaction } = useStore();
  const [type, setType] = useState<TxType>(tx.type);
  const [tag, setTag] = useState<string | null>(tx.tag);
  const [note, setNote] = useState(tx.note ?? "");
  const bank = tx.bankId === "cash" ? "نقدی" : (banks.find((b) => b.id === tx.bankId)?.name ?? "بانک");

  function save() {
    updateTransaction(tx.id, { type, tag, note: note.trim() || null, tagged: tag !== null, typeUncertain: false });
    onClose();
  }

  return (
    <Sheet title={bank} onClose={onClose}>
      <div style={{ textAlign: "center", fontSize: "1.8rem", fontWeight: 700 }}>
        <Amount rial={tx.amount} type={type} />
        <div className="muted small" style={{ fontWeight: 400 }}>
          {new Date(tx.timestamp).toLocaleString("fa-IR", { dateStyle: "medium", timeStyle: "short" })}
        </div>
      </div>
      {tx.typeUncertain && (
        <div className="warn-box">
          <AlertTriangle size={16} /> نوع تراکنش را بررسی کنید
        </div>
      )}
      <TypeToggle value={type} onChange={setType} />
      <TagChips tags={tags} value={tag} onPick={(l) => setTag((cur) => (cur === l ? null : l))} />
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
