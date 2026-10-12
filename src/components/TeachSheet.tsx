import { AlertTriangle, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { faNum } from "../lib/format";
import { haptic } from "../lib/haptic";
import { rereadUnread, smsToTransaction } from "../lib/ingest";
import { normalizeText, parse } from "../lib/parser";
import { applyRules, learnRule, numberTokens } from "../lib/smsRules";
import { useStore } from "../store/useStore";
import type { TxType } from "../types";
import Amount from "./Amount";
import Sheet from "./Sheet";
import TypeToggle from "./TypeToggle";

const faDigits = (s: string) => s.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);

interface Props {
  bankId: string;
  /** Sample text to start from (an unread SMS or a transaction's SMS); empty lets the user paste one. */
  text?: string;
  /** Teaching from this unread SMS: it becomes a transaction. */
  unreadId?: string;
  /** Teaching from a misread transaction: its amount and type get corrected. */
  txId?: string;
  onClose: () => void;
}

/** Point at the amount in a sample SMS → a rule for this bank (lib/smsRules.ts). */
export default function TeachSheet({ bankId, text: initial = "", unreadId, txId, onClose }: Props) {
  const { banks, addBankRule, deleteBankRule, addTransactions, removeUnread, updateTransaction, showToast } = useStore();
  const bank = banks.find((b) => b.id === bankId);
  const [text, setText] = useState(initial);
  const norm = useMemo(() => normalizeText(text), [text]);
  // dates, times and masked card digits can't be the amount — leave them as plain text
  const tokens = useMemo(
    () => numberTokens(norm).filter((t) => t.value > 0 && !/[/:*]\s*$/.test(norm.slice(Math.max(0, t.start - 2), t.start)) && !/^\s*[/:*]/.test(norm.slice(t.end, t.end + 2))),
    [norm],
  );
  const guess = useMemo(() => applyRules(text, bank?.rules) ?? parse(text), [text, bank]);

  const [picked, setPicked] = useState<number | null>(null);
  const [type, setType] = useState<TxType | null>(null);
  const [unit, setUnit] = useState<"rial" | "toman" | null>(null);

  // Until the user picks, start from what the app already understands.
  const guessIdx = guess ? tokens.findIndex((t) => t.value === guess.amount || t.value * 10 === guess.amount) : -1;
  const idx = picked ?? (guessIdx >= 0 ? guessIdx : null);
  const token = idx !== null ? tokens[idx] : undefined;
  const autoToman = !!token && (/^\s*تومان/.test(norm.slice(token.end, token.end + 10)) || (guess?.amount === token.value * 10 && !/^\s*ریال/.test(norm.slice(token.end, token.end + 10))));
  const toman = unit ? unit === "toman" : autoToman;
  const txType = type ?? guess?.type ?? "expense";
  const rule = token ? learnRule(text, token, txType, toman) : null;

  function save() {
    if (!rule || !token || !bank) return;
    addBankRule(bank.id, rule);
    const s = useStore.getState();
    const taught = s.banks.find((b) => b.id === bank.id)!;
    let extra = 0;
    if (unreadId) {
      const u = s.unread.find((x) => x.id === unreadId);
      const tx = u && smsToTransaction(taught, u.text, u.ts);
      if (tx) addTransactions([tx]);
      removeUnread([unreadId]);
    }
    if (txId) updateTransaction(txId, { amount: toman ? token.value * 10 : token.value, type: txType, typeUncertain: false });
    const rest = useStore.getState().unread.filter((u) => u.bankId === bank.id);
    const { added, readIds } = rereadUnread(rest, useStore.getState().banks, useStore.getState().transactions);
    addTransactions(added);
    removeUnread(readIds);
    extra = readIds.length;
    haptic();
    showToast(extra ? `الگو ذخیره شد · ${faNum(extra)} پیامک دیگر هم خوانده شد` : "الگو ذخیره شد");
    onClose();
  }

  if (!bank) return null;

  // the SMS with every number as a tappable chip
  const parts: React.ReactNode[] = [];
  let pos = 0;
  tokens.forEach((t, i) => {
    parts.push(faDigits(norm.slice(pos, t.start)));
    parts.push(
      <button
        key={i}
        type="button"
        className={`sms-num${i === idx ? " on" : ""}`}
        onClick={() => {
          setPicked(i);
          setUnit(null);
        }}
      >
        {faDigits(t.raw)}
      </button>,
    );
    pos = t.end;
  });
  parts.push(faDigits(norm.slice(pos)));

  return (
    <Sheet title={`آموزش پیامک ${bank.name}`} onClose={onClose}>
      {!initial && (
        <>
          <span className="field-label">یک پیامک واقعی از این بانک را این‌جا بگذار</span>
          <textarea className="sms-input" rows={5} placeholder="متن پیامک…" value={text} onChange={(e) => setText(e.target.value)} />
        </>
      )}

      {tokens.length > 0 && (
        <>
          <span className="field-label">روی مبلغ تراکنش بزن</span>
          <div className="sms-preview">{parts}</div>

          <TypeToggle value={txType} onChange={setType} />
          <div className="seg">
            <button type="button" className={!toman ? "on" : ""} onClick={() => setUnit("rial")}>
              ریال
            </button>
            <button type="button" className={toman ? "on" : ""} onClick={() => setUnit("toman")}>
              تومان
            </button>
          </div>

          {token &&
            (rule ? (
              <div className="teach-result">
                <span className="muted small">از این به بعد پیامک‌های مشابه این‌طور خوانده می‌شوند:</span>
                <Amount rial={toman ? token.value * 10 : token.value} type={txType} className="teach-amount" />
                <span className="muted small">
                  عدد بعد از «{rule.before || "—"}»{rule.after && <> و قبل از «{rule.after}»</>}
                  {rule.keyword && <> وقتی «{rule.keyword}» در پیامک باشد</>}
                </span>
              </div>
            ) : (
              <div className="warn-box">
                <AlertTriangle size={16} /> کنار این عدد کلمه‌ای نیست که بشود با آن شناختش؛ عدد دیگری را انتخاب کن.
              </div>
            ))}

          <button type="button" className="btn btn-primary btn-block" disabled={!rule} onClick={save}>
            ذخیره‌ی الگو
          </button>
        </>
      )}
      {text && tokens.length === 0 && <div className="empty small">در این متن عددی نیست</div>}

      {(bank.rules?.length ?? 0) > 0 && (
        <section>
          <div className="section-title">الگوهای ذخیره‌شده‌ی {bank.name}</div>
          <div className="card-soft">
            {bank.rules!.map((r) => (
              <div key={r.id} className="list-row">
                <div className="grow">
                  <div className="small" style={{ fontWeight: 600 }}>
                    {r.type === "income" ? "درآمد" : "هزینه"}: بعد از «{r.before || "—"}»{r.after && ` · قبل از «${r.after}»`}
                  </div>
                  <div className="muted small rule-sample">{r.sample}</div>
                </div>
                <button type="button" className="icon-btn" aria-label="حذف الگو" onClick={() => deleteBankRule(bank.id, r.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </Sheet>
  );
}
