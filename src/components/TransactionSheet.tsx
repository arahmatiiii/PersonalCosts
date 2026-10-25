import { AlertTriangle, Trash2, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { allFunds, fundDisplay } from "../lib/funds";
import { useStore } from "../store/useStore";
import type { Transaction, TxType } from "../types";
import { haptic } from "../lib/haptic";
import Amount from "./Amount";
import Sheet from "./Sheet";
import TagChips from "./TagChips";
import TeachSheet from "./TeachSheet";
import TypeToggle from "./TypeToggle";

export default function TransactionSheet({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const { tags, banks, transactions, updateTransaction, deleteTransaction, addTransactions, showToast } = useStore();
  const [type, setType] = useState<TxType>(tx.type);
  const [tag, setTag] = useState<string | null>(tx.tag);
  // Selected pot label, or null.
  const [fund, setFund] = useState<string | null>(tx.fund ?? null);
  const [note, setNote] = useState(tx.note ?? "");
  const [teaching, setTeaching] = useState(false);
  const bank = tx.bankId === "cash" ? "نقدی" : (banks.find((b) => b.id === tx.bankId)?.name ?? "بانک");
  const fundLabels = useMemo(() => allFunds(transactions.filter((t) => t.id !== tx.id)).filter((f) => f.remaining > 0).map((f) => f.label), [tx, transactions]);

  const kindTags = tags.filter((t) => t.kind === (type === "income" ? "fund" : "expense"));

  function changeType(next: TxType) {
    setType(next);
    if (tag && !tags.some((t) => t.label === tag && t.kind === (next === "income" ? "fund" : "expense"))) setTag(null);
  }

  function save() {
    updateTransaction(tx.id, {
      type,
      tag,
      fund: type === "expense" ? fund ?? null : null,
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
      {type === "expense" && fundLabels.length > 0 && (
        <div className="fund-pick">
          <span className="fund-pick-label">
            <Wallet size={16} /> از
          </span>
          <div className="chips">
            {fundLabels.map((f) => (
              <button key={f} type="button" className={`chip outline${fund === f ? " on" : ""}`} onClick={() => setFund((cur) => (cur === f ? null : f))}>
                {fundDisplay(f)}
              </button>
            ))}
          </div>
        </div>
      )}
      <input placeholder="یادداشت" value={note} onChange={(e) => setNote(e.target.value)} />
      {tx.rawText && <pre className="raw">{tx.rawText}</pre>}
      {tx.source === "sms" && tx.rawText && banks.some((b) => b.id === tx.bankId) && (
        <button type="button" className="link-btn" onClick={() => setTeaching(true)}>
          مبلغ یا نوع اشتباه خوانده شده؟ آموزش بده
        </button>
      )}
      {teaching && <TeachSheet bankId={tx.bankId} text={tx.rawText} txId={tx.id} onClose={() => setTeaching(false)} />}
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