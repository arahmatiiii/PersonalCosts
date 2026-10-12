import { Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { faNum, startOfDay, tomanInputToRial } from "../lib/format";
import { haptic } from "../lib/haptic";
import DatePicker from "./DatePicker";
import { fundDisplay, fundOptionsFor } from "../lib/funds";
import { newId } from "../lib/id";
import { useStore } from "../store/useStore";
import { CASH_BANK_ID, type TxType } from "../types";
import Sheet from "./Sheet";
import TagChips from "./TagChips";
import TypeToggle from "./TypeToggle";

export default function AddSheet({ onClose }: { onClose: () => void }) {
  const { banks, tags, transactions, addTransactions, showToast } = useStore();
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<TxType>("expense");
  const [bankId, setBankId] = useState(CASH_BANK_ID);
  const [when, setWhen] = useState<"today" | "yesterday" | "pick">("today");
  const [picked, setPicked] = useState(() => {
    const d = startOfDay(new Date());
    d.setDate(d.getDate() - 2);
    return d;
  });
  const [tag, setTag] = useState<string | null>(null);
  const [fund, setFund] = useState<string | null>(null); // "label|monthKey"
  const [note, setNote] = useState("");
  const rial = tomanInputToRial(amount);
  const timestamp = timestampFor(when, picked);
  const kindTags = tags.filter((t) => t.kind === (type === "income" ? "fund" : "expense"));
  const funds = useMemo(() => (type === "expense" ? fundOptionsFor({ timestamp }, transactions) : []), [type, timestamp, transactions]);

  function changeType(next: TxType) {
    setType(next);
    setTag(null);
    setFund(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rial) return;
    addTransactions([
      {
        id: newId(),
        amount: rial,
        type,
        bankId,
        timestamp,
        rawText: "",
        source: "manual",
        tag,
        note: note.trim() || null,
        tagged: tag !== null,
        typeUncertain: false,
        fund: fund ? fund.split("|")[0] : null,
        fundMonth: fund ? fund.split("|")[1] : null,
        createdAt: Date.now(),
      },
    ]);
    haptic();
    showToast(type === "expense" ? "هزینه ثبت شد" : "درآمد ثبت شد");
    onClose();
  }

  const accounts = [{ id: CASH_BANK_ID, name: "نقدی" }, ...banks];

  return (
    <Sheet title="تراکنش جدید" onClose={onClose}>
      <form className="stack" style={{ gap: 16 }} onSubmit={submit}>
        <div className="amount-field">
          <input
            className="amount-input num"
            inputMode="numeric"
            placeholder="۰"
            autoFocus
            value={rial ? faNum(rial / 10) : ""}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="مبلغ به تومان"
          />
          <span className="amount-unit">تومان</span>
        </div>
        <div className="chips quick-amounts">
          {[50_000, 100_000, 200_000, 500_000].map((v) => (
            <button key={v} type="button" className="chip outline" onClick={() => setAmount(String((rial ?? 0) / 10 + v))}>
              +{faNum(v / 1000)} هزار
            </button>
          ))}
        </div>
        <TypeToggle value={type} onChange={changeType} />
        {accounts.length > 1 && (
          <div className="chips">
            {accounts.map((a) => (
              <button key={a.id} type="button" className={`chip outline${bankId === a.id ? " on" : ""}`} onClick={() => setBankId(a.id)}>
                {a.name}
              </button>
            ))}
          </div>
        )}
        <span className="field-label">{type === "income" ? "این درآمد کدام پول است؟" : "تگ هزینه"}</span>
        <TagChips tags={kindTags} value={tag} onPick={(l) => setTag((cur) => (cur === l ? null : l))} />
        {kindTags.length === 0 && <span className="muted small">در تنظیمات یک {type === "income" ? "تگ پول" : "تگ هزینه"} بساز.</span>}
        {funds.length > 0 && (
          <div className="fund-pick">
            <span className="fund-pick-label">
              <Wallet size={16} /> از
            </span>
            <div className="chips">
              {funds.map((f) => {
                const id = `${f.label}|${f.key}`;
                return (
                  <button key={id} type="button" className={`chip outline${fund === id ? " on" : ""}`} onClick={() => setFund((cur) => (cur === id ? null : id))}>
                    {fundDisplay(f.label, f.key, timestamp)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <input placeholder="یادداشت" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="seg">
          {(
            [
              ["today", "امروز"],
              ["yesterday", "دیروز"],
              ["pick", "تاریخ دیگر"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" className={when === k ? "on" : ""} onClick={() => setWhen(k)}>
              {label}
            </button>
          ))}
        </div>
        {when === "pick" && <DatePicker value={picked} onChange={setPicked} />}
        <button type="submit" className="btn btn-primary btn-block" disabled={!rial}>
          افزودن
        </button>
      </form>
    </Sheet>
  );
}

/** Now for today; the same clock time on a past day otherwise (keeps ordering within that day sensible). */
function timestampFor(when: "today" | "yesterday" | "pick", picked: Date): number {
  const now = new Date();
  if (when === "today") return now.getTime();
  const d = when === "yesterday" ? new Date(now.getTime() - 86_400_000) : new Date(picked);
  d.setHours(now.getHours(), now.getMinutes(), 0, 0);
  return d.getTime();
}
