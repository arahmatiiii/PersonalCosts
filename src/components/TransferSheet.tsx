import { ArrowDown } from "lucide-react";
import { useMemo, useState } from "react";
import { faNum, formatToman, startOfDay, tomanInputToRial } from "../lib/format";
import { allFunds } from "../lib/funds";
import { haptic } from "../lib/haptic";
import { useStore } from "../store/useStore";
import DatePicker from "./DatePicker";
import Sheet from "./Sheet";

/** Move money from one «پول» to another: neither an income nor an expense, just a different pot. */
export default function TransferSheet({ from: initialFrom, onClose }: { from?: string; onClose: () => void }) {
  const { tags, transactions, transfers, addTransfer, showToast } = useStore();
  const funds = useMemo(() => allFunds(transactions, transfers), [transactions, transfers]);
  // Every «پول» tag can receive money, even one that has had no income yet.
  const labels = useMemo(() => [...new Set([...funds.map((f) => f.label), ...tags.filter((t) => t.kind === "fund").map((t) => t.label)])], [funds, tags]);
  const [from, setFrom] = useState<string | null>(initialFrom ?? funds.find((f) => f.remaining > 0)?.label ?? null);
  const [to, setTo] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [today, setToday] = useState(true);
  const [picked, setPicked] = useState(() => startOfDay(new Date()));
  const [note, setNote] = useState("");
  const rial = tomanInputToRial(amount);
  const left = funds.find((f) => f.label === from)?.remaining ?? 0;
  const color = (l: string) => tags.find((t) => t.label === l && t.kind === "fund")?.color ?? "var(--primary)";
  const ok = !!rial && !!from && !!to && from !== to;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ok) return;
    const now = new Date();
    const d = today ? now : new Date(picked);
    if (!today) d.setHours(now.getHours(), now.getMinutes(), 0, 0);
    addTransfer({ from: from!, to: to!, amount: rial!, timestamp: d.getTime(), note: note.trim() || null });
    haptic();
    showToast(`${formatToman(rial!)} از «${from}» به «${to}» رفت`);
    onClose();
  }

  const chips = (value: string | null, set: (l: string) => void, disabled?: string | null) => (
    <div className="chips">
      {labels.map((l) => (
        <button
          key={l}
          type="button"
          disabled={l === disabled}
          className={`chip${value === l ? " on" : ""}`}
          style={{ "--c": color(l) } as React.CSSProperties}
          onClick={() => set(l)}
        >
          {l}
        </button>
      ))}
    </div>
  );

  return (
    <Sheet title="جابجایی بین پول‌ها" onClose={onClose}>
      {labels.length < 2 ? (
        <div className="muted small">برای جابجایی دست‌کم دو پول لازم است؛ در تنظیمات یک «پول» دیگر بساز.</div>
      ) : (
        <form className="stack" style={{ gap: 14 }} onSubmit={submit}>
          <span className="field-label">از</span>
          {chips(from, setFrom)}
          {from && (
            <span className="muted small">
              مانده: <span className="num">{formatToman(left)}</span>
            </span>
          )}
          <div className="transfer-arrow">
            <ArrowDown size={20} />
          </div>
          <span className="field-label">به</span>
          {chips(to, setTo, from)}
          <div className="amount-field">
            <input
              className="amount-input num"
              inputMode="numeric"
              placeholder="۰"
              value={rial ? faNum(rial / 10) : ""}
              onChange={(e) => setAmount(e.target.value)}
              aria-label="مبلغ به تومان"
            />
            <span className="amount-unit">تومان</span>
          </div>
          {from && left > 0 && (
            <div className="chips">
              <button type="button" className="chip outline" onClick={() => setAmount(String(Math.round(left / 10)))}>
                همه‌ی مانده
              </button>
            </div>
          )}
          <input placeholder="یادداشت" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="seg">
            <button type="button" className={today ? "on" : ""} onClick={() => setToday(true)}>
              امروز
            </button>
            <button type="button" className={today ? "" : "on"} onClick={() => setToday(false)}>
              تاریخ دیگر
            </button>
          </div>
          {!today && <DatePicker value={picked} onChange={setPicked} />}
          <button type="submit" className="btn btn-primary btn-block" disabled={!ok}>
            جابجا کن
          </button>
        </form>
      )}
    </Sheet>
  );
}
