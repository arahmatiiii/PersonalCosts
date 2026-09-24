import { ChevronLeft, ChevronRight, Search, Wallet, X } from "lucide-react";
import { useMemo, useState } from "react";
import { endOfDay, startOfDay, startOfWeek } from "../lib/format";
import { fundsForMonth } from "../lib/funds";
import { addMonths, monthLabel, monthOf, monthRange, sameMonth } from "../lib/jalali";
import { normalizeText } from "../lib/parser";
import { useStore } from "../store/useStore";
import Amount from "./Amount";
import DatePicker from "./DatePicker";
import TransactionRow from "./TransactionRow";
import TransactionSheet from "./TransactionSheet";

type Range = "week" | "month" | "custom";
type Kind = "all" | "expense" | "income";
const UNTAGGED = "بدون تگ";
const LIST_PAGE = 20;

export default function StatsPage() {
  const { transactions, tags, banks } = useStore();
  const [range, setRange] = useState<Range>("month");
  const [month, setMonth] = useState(() => monthOf(new Date()));
  const [customFrom, setCustomFrom] = useState(() => startOfWeek(new Date()));
  const [customTo, setCustomTo] = useState(() => startOfDay(new Date()));
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [selTags, setSelTags] = useState<string[]>([]);
  const [listLimit, setListLimit] = useState(LIST_PAGE);
  const [openId, setOpenId] = useState<string | null>(null);

  const [from, to] = useMemo((): [number, number] => {
    if (range === "week") return [startOfWeek(new Date()).getTime(), endOfDay(new Date()).getTime()];
    if (range === "month") return monthRange(month);
    const [a, b] = customFrom <= customTo ? [customFrom, customTo] : [customTo, customFrom];
    return [startOfDay(a).getTime(), endOfDay(b).getTime()];
  }, [range, month, customFrom, customTo]);

  const bankById = useMemo(() => new Map(banks.map((b) => [b.id, b])), [banks]);

  const filtered = useMemo(() => {
    const q = normalizeText(query.trim()).toLowerCase();
    return transactions
      .filter((t) => t.timestamp >= from && t.timestamp <= to)
      .filter((t) => kind === "all" || t.type === kind)
      .filter((t) => selTags.length === 0 || selTags.includes(t.tag ?? UNTAGGED))
      .filter((t) => {
        if (!q) return true;
        const bank = t.bankId === "cash" ? "نقدی" : (bankById.get(t.bankId)?.name ?? "");
        const hay = normalizeText([t.tag, t.note, t.fund, bank, t.rawText, String(Math.round(t.amount / 10))].filter(Boolean).join(" ")).toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [transactions, from, to, kind, selTags, query, bankById]);

  const { income, expense, byTag } = useMemo(() => {
    let income = 0;
    let expense = 0;
    const m = new Map<string, number>();
    for (const t of filtered) {
      if (t.type === "income") income += t.amount;
      else {
        expense += t.amount;
        m.set(t.tag ?? UNTAGGED, (m.get(t.tag ?? UNTAGGED) ?? 0) + t.amount);
      }
    }
    const byTag = [...m.entries()]
      .map(([label, amount]) => ({ label, amount, color: tags.find((t) => t.label === label)?.color ?? "#94a3b8" }))
      .sort((a, b) => b.amount - a.amount);
    return { income, expense, byTag };
  }, [filtered, tags]);

  const funds = useMemo(() => (range === "month" ? fundsForMonth(transactions, month) : []), [range, transactions, month]);
  const tagMax = byTag[0]?.amount ?? 1;
  const tagTotal = byTag.reduce((s, b) => s + b.amount, 0) || 1;
  const net = income - expense;
  const isCurrentMonth = sameMonth(month, monthOf(new Date()));
  const allTagLabels = [...tags.map((t) => t.label), UNTAGGED];
  const open = openId ? transactions.find((t) => t.id === openId) : undefined;

  const toggleTag = (l: string) => setSelTags((s) => (s.includes(l) ? s.filter((x) => x !== l) : [...s, l]));

  return (
    <>
      <h1 className="page-title">آمار</h1>

      <div className="seg">
        {(["week", "month", "custom"] as Range[]).map((r) => (
          <button key={r} type="button" className={range === r ? "on" : ""} onClick={() => setRange(r)}>
            {{ week: "هفته", month: "ماه", custom: "دلخواه" }[r]}
          </button>
        ))}
      </div>
      {range === "month" && (
        <div className="month-nav">
          <button type="button" className="icon-btn" aria-label="ماه قبل" onClick={() => setMonth((m) => addMonths(m, -1))}>
            <ChevronRight size={20} />
          </button>
          <span>{monthLabel(month)}</span>
          <button type="button" className="icon-btn" aria-label="ماه بعد" disabled={isCurrentMonth} onClick={() => setMonth((m) => addMonths(m, 1))}>
            <ChevronLeft size={20} />
          </button>
        </div>
      )}
      {range === "custom" && (
        <div className="stack" style={{ gap: 8 }}>
          <div className="row">
            <span className="muted small range-label">از</span>
            <DatePicker value={customFrom} onChange={setCustomFrom} />
          </div>
          <div className="row">
            <span className="muted small range-label">تا</span>
            <DatePicker value={customTo} onChange={setCustomTo} />
          </div>
        </div>
      )}

      <div className="search">
        <Search size={18} />
        <input placeholder="جستجو: تگ، یادداشت، بانک، مبلغ…" value={query} onChange={(e) => setQuery(e.target.value)} />
        {query && (
          <button type="button" className="icon-btn" aria-label="پاک کردن" onClick={() => setQuery("")}>
            <X size={16} />
          </button>
        )}
      </div>
      <div className="chips scroll">
        {(["all", "expense", "income"] as Kind[]).map((k) => (
          <button key={k} type="button" className={`chip outline${kind === k ? " on" : ""}`} onClick={() => setKind(k)}>
            {{ all: "همه", expense: "هزینه‌ها", income: "پول‌ها" }[k]}
          </button>
        ))}
        <span className="chip-sep" />
        {allTagLabels.map((l) => (
          <button
            key={l}
            type="button"
            className={`chip${selTags.includes(l) ? " on" : ""}`}
            style={{ "--c": tags.find((t) => t.label === l)?.color ?? "#94a3b8" } as React.CSSProperties}
            onClick={() => toggleTag(l)}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="card summary">
        <div>
          <div className="muted small">خالص</div>
          <Amount rial={net} type={net >= 0 ? "income" : "expense"} className="net" />
        </div>
        <div className="split">
          <div>
            <span className="muted small">پول‌ها</span>
            <Amount rial={income} className="income" />
          </div>
          <div>
            <span className="muted small">هزینه‌ها</span>
            <Amount rial={expense} className="expense" />
          </div>
        </div>
      </div>

      {funds.length > 0 && (
        <section>
          <div className="section-title">خرج از هر پول</div>
          <div className="card bars">
            {funds.map((f) => {
              const color = tags.find((t) => t.label === f.label)?.color ?? "var(--primary)";
              return (
                <div key={f.label} className="bar-row">
                  <div className="row">
                    <Wallet size={16} style={{ color }} />
                    <span className="grow">{f.label}</span>
                    <span className="muted small">
                      <Amount rial={f.spent} /> از <Amount rial={f.total} />
                    </span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${f.total ? Math.min(100, (f.spent / f.total) * 100) : 0}%`, background: color }} />
                  </div>
                  <span className={`small ${f.remaining < 0 ? "expense" : "muted"}`}>
                    مانده: <Amount rial={f.remaining} />
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {byTag.length > 0 && (
        <section>
          <div className="section-title">هزینه بر اساس تگ</div>
          <div className="card bars">
            {byTag.map((b) => (
              <button key={b.label} type="button" className="bar-row" onClick={() => toggleTag(b.label)}>
                <div className="row">
                  <span className="dot" style={{ background: b.color }} />
                  <span className="grow">{b.label}</span>
                  <span className="muted small num">{Math.round((b.amount / tagTotal) * 100).toLocaleString("fa-IR")}٪</span>
                  <Amount rial={b.amount} />
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(b.amount / tagMax) * 100}%`, background: b.color }} />
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="section-title">
          تراکنش‌ها <span className="num">({filtered.length.toLocaleString("fa-IR")})</span>
        </div>
        {filtered.length === 0 ? (
          <div className="empty">چیزی پیدا نشد</div>
        ) : (
          <div className="card tx-group">
            {filtered.slice(0, listLimit).map((t) => (
              <TransactionRow key={t.id} tx={t} bank={bankById.get(t.bankId)} tags={tags} showDate onOpen={() => setOpenId(t.id)} />
            ))}
          </div>
        )}
        {filtered.length > listLimit && (
          <button type="button" className="link-btn" onClick={() => setListLimit((l) => l + LIST_PAGE)}>
            بیشتر
          </button>
        )}
      </section>

      {open && <TransactionSheet key={open.id} tx={open} onClose={() => setOpenId(null)} />}
    </>
  );
}
