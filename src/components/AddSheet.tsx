import { useState } from "react";
import { tomanInputToRial } from "../lib/format";
import { newId } from "../lib/id";
import { useStore } from "../store/useStore";
import { CASH_BANK_ID, type TxType } from "../types";
import Sheet from "./Sheet";
import TagChips from "./TagChips";
import TypeToggle from "./TypeToggle";

export default function AddSheet({ onClose }: { onClose: () => void }) {
  const { banks, tags, addTransactions } = useStore();
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<TxType>("expense");
  const [bankId, setBankId] = useState(CASH_BANK_ID);
  const [daysAgo, setDaysAgo] = useState(0);
  const [tag, setTag] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const rial = tomanInputToRial(amount);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rial) return;
    addTransactions([
      {
        id: newId(),
        amount: rial,
        type,
        bankId,
        timestamp: Date.now() - daysAgo * 86_400_000,
        rawText: "",
        source: "manual",
        tag,
        note: note.trim() || null,
        tagged: tag !== null,
        typeUncertain: false,
        createdAt: Date.now(),
      },
    ]);
    onClose();
  }

  const accounts = [{ id: CASH_BANK_ID, name: "نقدی" }, ...banks];

  return (
    <Sheet title="تراکنش جدید" onClose={onClose}>
      <form className="stack" style={{ gap: 16 }} onSubmit={submit}>
        <input className="amount-input num" inputMode="numeric" placeholder="۰ تومان" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} />
        <TypeToggle value={type} onChange={setType} />
        {accounts.length > 1 && (
          <div className="chips">
            {accounts.map((a) => (
              <button key={a.id} type="button" className={`chip outline${bankId === a.id ? " on" : ""}`} onClick={() => setBankId(a.id)}>
                {a.name}
              </button>
            ))}
          </div>
        )}
        <TagChips tags={tags} value={tag} onPick={(l) => setTag((cur) => (cur === l ? null : l))} />
        <input placeholder="یادداشت" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="seg">
          {["امروز", "دیروز", "پریروز"].map((label, i) => (
            <button key={label} type="button" className={daysAgo === i ? "on" : ""} onClick={() => setDaysAgo(i)}>
              {label}
            </button>
          ))}
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={!rial}>
          افزودن
        </button>
      </form>
    </Sheet>
  );
}
