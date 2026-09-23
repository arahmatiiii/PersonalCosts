import { useState } from "react";
import { addManualTransaction } from "../hooks/useTransactions";
import { toDateTimeInput, tomanInputToRial } from "../lib/format";
import type { Bank, Tag, TxType } from "../types";
import TagPicker from "./TagPicker";
import TypeToggle from "./TypeToggle";

export const CASH_BANK_ID = "cash";

interface Props {
  banks: Bank[];
  tags: Tag[];
  onClose: () => void;
}

export default function TransactionForm({ banks, tags, onClose }: Props) {
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<TxType>("expense");
  const [bankId, setBankId] = useState(CASH_BANK_ID);
  const [when, setWhen] = useState(toDateTimeInput(new Date()));
  const [tag, setTag] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const rial = tomanInputToRial(amount);
    if (!rial) return setError("مبلغ را وارد کنید");
    setBusy(true);
    try {
      await addManualTransaction({
        amount: rial,
        type,
        bankId,
        timestamp: new Date(when),
        tag,
        note: note.trim() || null,
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="card modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>افزودن تراکنش دستی</h2>
        <label>
          مبلغ (تومان)
          <input inputMode="numeric" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <TypeToggle value={type} onChange={setType} />
        <label>
          حساب
          <select value={bankId} onChange={(e) => setBankId(e.target.value)}>
            <option value={CASH_BANK_ID}>نقدی</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          زمان
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </label>
        <TagPicker tags={tags} value={tag} onPick={(l) => setTag((cur) => (cur === l ? null : l))} />
        <input placeholder="یادداشت (اختیاری)" value={note} onChange={(e) => setNote(e.target.value)} />
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button type="submit" className="primary" disabled={busy}>
            ذخیره
          </button>
          <button type="button" onClick={onClose}>
            انصراف
          </button>
        </div>
      </form>
    </div>
  );
}
