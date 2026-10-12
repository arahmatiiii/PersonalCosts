import { ChevronLeft, Sparkles } from "lucide-react";
import { useState } from "react";
import { formatRelative } from "../lib/format";
import { useStore } from "../store/useStore";
import type { Transaction } from "../types";
import { haptic } from "../lib/haptic";
import Amount from "./Amount";
import TagChips from "./TagChips";

/** One untagged transaction at a time: «این چی بود؟» + one-tap tags. */
export default function ReviewCard({ items }: { items: Transaction[] }) {
  const { tags, banks, tagTransaction, updateTransaction, showToast } = useStore();
  const [skip, setSkip] = useState(0);
  if (items.length === 0) return null;
  const i = skip % items.length;
  const tx = items[i];
  const bank = tx.bankId === "cash" ? "نقدی" : (banks.find((b) => b.id === tx.bankId)?.name ?? "بانک");

  return (
    <div className="card review" key={tx.id}>
      <div className="row">
        <Sparkles size={18} className="review-icon" />
        <span className="grow review-q">این چی بود؟</span>
        <span className="muted small num">
          {(i + 1).toLocaleString("fa-IR")} / {items.length.toLocaleString("fa-IR")}
        </span>
        {items.length > 1 && (
          <button type="button" className="icon-btn" aria-label="بعدی" onClick={() => setSkip((s) => s + 1)}>
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
      <TagChips tags={tags} value={null} scroll onPick={(label) => {
          haptic();
          tagTransaction(tx.id, label);
          const { id, fund = null, fundMonth = null, ...before } = tx;
          showToast(`«${label}» ثبت شد`, () => updateTransaction(id, { ...before, fund, fundMonth }));
        }}
      />
    </div>
  );
}
