import { ChevronLeft, Sparkles, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { formatRelative } from "../lib/format";
import { allFunds, fundDisplay } from "../lib/funds";
import { haptic } from "../lib/haptic";
import { useStore } from "../store/useStore";
import type { Transaction } from "../types";
import Amount from "./Amount";
import TagChips from "./TagChips";

/** One untagged transaction at a time: «این چی بود؟», which «پول» paid (expenses), then one-tap tag. */
export default function ReviewCard({ items }: { items: Transaction[] }) {
  const { tags, banks, transactions, tagTransaction, updateTransaction, showToast } = useStore();
  const [skip, setSkip] = useState(0);
  const [fund, setFund] = useState<string | null>(null);
  const tx = items.length ? items[skip % items.length] : undefined;
  const fundLabels = useMemo(() => (tx?.type === "expense" ? allFunds(transactions).filter((f) => f.remaining > 0).map((f) => f.label) : []), [tx, transactions]);
  if (!tx) return null;
  const i = skip % items.length;
  const bank = tx.bankId === "cash" ? "نقدی" : (banks.find((b) => b.id === tx.bankId)?.name ?? "بانک");
  const kindTags = tags.filter((t) => t.kind === (tx.type === "income" ? "fund" : "expense"));

  return (
    <div className="card review" key={tx.id}>
      <div className="row">
        <Sparkles size={18} className="review-icon" />
        <span className="grow review-q">این چی بود؟</span>
        <span className="muted small num">
          {(i + 1).toLocaleString("fa-IR")} / {items.length.toLocaleString("fa-IR")}
        </span>
        {items.length > 1 && (
          <button
            type="button"
            className="icon-btn"
            aria-label="بعدی"
            onClick={() => {
              setSkip((s) => s + 1);
              setFund(null);
            }}
          >
            <ChevronLeft size={20} />
          </button>
        )}
      </div>
      <div className="review-amount">
        <Amount rial={tx.amount} type={tx.type} />
        <span className="muted small">
          {bank} · {formatRelative(new Date(tx.timestamp))}
        </span>
      </div>
      {fundLabels.length > 0 && (
        <div className="fund-pick">
          <span className="fund-pick-label">
            <Wallet size={16} /> از
          </span>
          <div className="chips scroll">
            {fundLabels.map((f) => (
              <button key={f} type="button" className={`chip outline${fund === f ? " on" : ""}`} onClick={() => setFund((cur) => (cur === f ? null : f))}>
                {fundDisplay(f)}
              </button>
            ))}
          </div>
        </div>
      )}
      <TagChips
        tags={kindTags}
        value={null}
        scroll
        onPick={(label) => {
          haptic();
          tagTransaction(tx.id, label, tx.type === "expense" ? { fund: fund ?? undefined } : undefined);
          setFund(null);
          const { id, fund: oldFund = null, ...before } = tx;
          showToast(`«${label}» ثبت شد`, () => updateTransaction(id, { ...before, fund: oldFund }));
        }}
      />
      {kindTags.length === 0 && <span className="muted small">در تنظیمات یک {tx.type === "income" ? "تگ پول" : "تگ هزینه"} بساز.</span>}
    </div>
  );
}