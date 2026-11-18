import { AlertTriangle, Pencil, Split, Trash2, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { faNum, tomanInputToRial } from "../lib/format";
import { allFunds, fundDisplay } from "../lib/funds";
import { useStore } from "../store/useStore";
import type { Transaction, TxType } from "../types";
import { haptic } from "../lib/haptic";
import Sheet from "./Sheet";
import TagChips from "./TagChips";
import TeachSheet from "./TeachSheet";
import TypeToggle from "./TypeToggle";

export default function TransactionSheet({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const { tags, banks, transactions, transfers, updateTransaction, deleteTransaction, addTransactions, splitMerged, showToast } = useStore();
  const [type, setType] = useState<TxType>(tx.type);
  const [amount, setAmount] = useState(String(Math.round(tx.amount / 10)));
  const rial = tomanInputToRial(amount);
  const [tag, setTag] = useState<string | null>(tx.tag);
  // Selected pot label, or null.
  const [fund, setFund] = useState<string | null>(tx.fund ?? null);
  const [note, setNote] = useState(tx.note ?? "");
  const [teaching, setTeaching] = useState(false);
  const bank = tx.bankId === "cash" ? "نقدی" : (banks.find((b) => b.id === tx.bankId)?.name ?? "بانک");
  const fundLabels = useMemo(() => allFunds(transactions.filter((t) => t.id !== tx.id), transfers).filter((f) => f.remaining > 0).map((f) => f.label), [tx, transactions, transfers]);

  const kindTags = tags.filter((t) => t.kind === (type === "income" ? "fund" : "expense"));

  function changeType(next: TxType) {
    setType(next);
    if (tag && !tags.some((t) => t.label === tag && t.kind === (next === "income" ? "fund" : "expense"))) setTag(null);
  }

  function save() {
    if (!rial) return;
    updateTransaction(tx.id, {
      amount: rial,
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
        <label className={`amount-field edit ${type}`}>
          <span className="amount-sign">{type === "income" ? "+" : "−"}</span>
          <input
            className="amount-input num"
            inputMode="numeric"
            value={rial ? faNum(rial / 10) : ""}
            placeholder="۰"
            onChange={(e) => setAmount(e.target.value)}
            aria-label="مبلغ به تومان"
          />
          <span className="amount-unit">تومان</span>
          <Pencil size={14} className="muted" />
        </label>
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
      {tx.mergedText && (
        <>
          <span className="muted small">پیامک دوم همین هزینه (یک بار حساب شده):</span>
          <pre className="raw">{tx.mergedText}</pre>
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              splitMerged(tx.id);
              showToast("دو تراکنش جدا شدند");
              onClose();
            }}
          >
            <Split size={14} /> این‌ها دو خرج جدا بودند
          </button>
        </>
      )}
      {tx.source === "sms" && tx.rawText && banks.some((b) => b.id === tx.bankId) && (
        <button type="button" className="link-btn" onClick={() => setTeaching(true)}>
          مبلغ یا نوع اشتباه خوانده شده؟ آموزش بده
        </button>
      )}
      {teaching && <TeachSheet bankId={tx.bankId} text={tx.rawText} txId={tx.id} onClose={() => setTeaching(false)} />}
      <button type="button" className="btn btn-primary btn-block" disabled={!rial} onClick={save}>
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