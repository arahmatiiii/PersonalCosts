import { ChevronLeft, ChevronRight, CircleDollarSign, Search, Sparkles, Wallet, X } from "lucide-react";
import { useMemo, useState } from "react";
import { endOfDay, faNum, rialToToman, startOfDay } from "../lib/format";
import { addMonths, MONTHS, monthLabel, monthOf, monthRange, sameMonth, toJalali, type JMonth } from "../lib/jalali";
import { normalizeText } from "../lib/parser";
import { dailyExpense, daysIn, fundsInRange, tagBreakdown, UNTAGGED, unfundedExpenses } from "../lib/stats";
import { useStore } from "../store/useStore";
import Amount from "./Amount";
import { Donut, Heatmap, SliceList } from "./Charts";
import DatePicker from "./DatePicker";
import FundSheet from "./FundSheet";
import TransactionRow from "./TransactionRow";
import TransactionSheet from "./TransactionSheet";

type View = "overview" | "funds";
type Kind = "all" | "expense" | "income";
const LIST_PAGE = 20;

/** The period every Stats tab works on: one Jalali month, or any custom range of days. */
interface Period {
  from: number;
  to: number;
  label: string;
  /** Set when the period is exactly one month (enables the calendar). */
  month: JMonth | null;
}

const dayLabel = (d: Date) => {
  const j = toJalali(d);
  return `${faNum(j.jd)} ${MONTHS[j.jm - 1]}`;
};

export default function StatsPage() {
  const [view, setView] = useState<View>("overview");
  const [mode, setMode] = useState<"month" | "custom">("month");
  const [month, setMonth] = useState(() => monthOf(new Date()));
  const [customFrom, setCustomFrom] = useState(() => {
    const d = startOfDay(new Date());
    d.setDate(d.getDate() - 29);
    return d;
  });
  const [customTo, setCustomTo] = useState(() => startOfDay(new Date()));

  const period = useMemo((): Period => {
    if (mode === "month") {
      const [from, to] = monthRange(month);
      return { from, to, label: monthLabel(month), month };
    }
    const [a, b] = customFrom <= customTo ? [customFrom, customTo] : [customTo, customFrom];
    return { from: startOfDay(a).getTime(), to: endOfDay(b).getTime(), label: `${dayLabel(a)} تا ${dayLabel(b)}`, month: null };
  }, [mode, month, customFrom, customTo]);
  const days = Math.round((period.to + 1 - period.from) / 86_400_000);

  return (
    <>
      <h1 className="page-title">آمار</h1>

      <div className="seg">
        <button type="button" className={mode === "month" ? "on" : ""} onClick={() => setMode("month")}>
          ماه
        </button>
        <button type="button" className={mode === "custom" ? "on" : ""} onClick={() => setMode("custom")}>
          بازه‌ی دلخواه
        </button>
      </div>
      {mode === "month" ? (
        <div className="month-nav">
          <button type="button" className="icon-btn" aria-label="ماه قبل" onClick={() => setMonth((m) => addMonths(m, -1))}>
            <ChevronRight size={20} />
          </button>
          <span>{monthLabel(month)}</span>
          <button type="button" className="icon-btn" aria-label="ماه بعد" disabled={sameMonth(month, monthOf(new Date()))} onClick={() => setMonth((m) => addMonths(m, 1))}>
            <ChevronLeft size={20} />
          </button>
        </div>
      ) : (
        <div className="stack" style={{ gap: 8 }}>
          <div className="row">
            <span className="muted small range-label">از</span>
            <DatePicker value={customFrom} onChange={setCustomFrom} />
          </div>
          <div className="row">
            <span className="muted small range-label">تا</span>
            <DatePicker value={customTo} onChange={setCustomTo} />
          </div>
          <span className="muted small range-days">{faNum(days)} روز</span>
        </div>
      )}

      <div className="tabs" role="tablist">
        {(
          [
            ["overview", "آمار کلی"],
            ["funds", "آمار پول‌ها"],
          ] as const
        ).map(([v, label]) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? "on" : ""} onClick={() => setView(v)}>
            {label}
          </button>
        ))}
      </div>
      {view === "overview" ? <Overview period={period} /> : <Funds period={period} />}
    </>
  );
}

// ------------------------------------------------------------------ کلی

function Overview({ period }: { period: Period }) {
  const { transactions, tags, banks } = useStore();
  const { from, to } = period;
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [selTags, setSelTags] = useState<string[]>([]);
  const [listLimit, setListLimit] = useState(LIST_PAGE);
  const [openId, setOpenId] = useState<string | null>(null);

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

  const { income, expense, slices } = useMemo(() => {
    const expenses = filtered.filter((t) => t.type === "expense");
    return {
      income: filtered.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
      expense: expenses.reduce((s, t) => s + t.amount, 0),
      slices: tagBreakdown(expenses, tags),
    };
  }, [filtered, tags]);
  const daily = useMemo(() => dailyExpense(filtered, from, to), [filtered, from, to]);

  const net = income - expense;
  const days = daysIn(from, to);
  const filterTags = kind === "income" ? tags.filter((t) => t.kind === "fund") : kind === "expense" ? tags.filter((t) => t.kind === "expense") : tags;
  const allTagLabels = [...new Set([...filterTags.map((t) => t.label), UNTAGGED])];
  const open = openId ? transactions.find((t) => t.id === openId) : undefined;
  const toggleTag = (l: string) => setSelTags((s) => (s.includes(l) ? s.filter((x) => x !== l) : [...s, l]));
  const hasFilter = query || kind !== "all" || selTags.length > 0;

  return (
    <>
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
            {{ all: "همه", expense: "هزینه", income: "درآمد" }[k]}
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
        {hasFilter && (
          <button
            type="button"
            className="chip ghost"
            onClick={() => {
              setQuery("");
              setKind("all");
              setSelTags([]);
            }}
          >
            <X size={14} /> پاک کردن فیلترها
          </button>
        )}
      </div>

      <div className="card summary">
        <div className="row">
          <div className="grow">
            <div className="muted small">خالص</div>
            <Amount rial={net} type={net >= 0 ? "income" : "expense"} className="net" />
          </div>
          <div className="summary-avg">
            <span className="muted small">میانگین خرج روزانه</span>
            <Amount rial={Math.round(expense / days)} />
          </div>
        </div>
        <div className="split">
          <div>
            <span className="muted small">درآمد</span>
            <Amount rial={income} className="income" />
          </div>
          <div>
            <span className="muted small">هزینه</span>
            <Amount rial={expense} className="expense" />
          </div>
        </div>
      </div>

      {slices.length > 0 && (
        <section>
          <div className="section-title">هزینه بر اساس تگ</div>
          <div className="card donut-card">
            <Donut slices={slices}>
              <span className="muted small">کل هزینه</span>
              <b className="num">{faNum(rialToToman(expense))}</b>
              <span className="muted small">تومان</span>
            </Donut>
            <SliceList slices={slices} active={selTags} onPick={toggleTag} />
          </div>
        </section>
      )}

      {period.month && expense > 0 && (
        <section>
          <div className="section-title">تقویم خرج</div>
          <div className="card heat-card">
            <Heatmap month={period.month} daily={daily} />
          </div>
        </section>
      )}

      <section>
        <div className="section-title">
          تراکنش‌ها <span className="num">({faNum(filtered.length)})</span>
        </div>
        {filtered.length === 0 ? (
          <div className="empty">
            <Search size={32} strokeWidth={1.5} />
            چیزی پیدا نشد
          </div>
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

// ------------------------------------------------------------------ پول‌ها

function Funds({ period }: { period: Period }) {
  const { transactions, tags } = useStore();
  const { from, to } = period;
  const [openFund, setOpenFund] = useState<string | null | undefined>(undefined);
  const funds = useMemo(() => fundsInRange(transactions, from, to), [transactions, from, to]);
  const unfunded = useMemo(() => unfundedExpenses(transactions, from, to), [transactions, from, to]);
  const income = funds.reduce((s, f) => s + f.income, 0);
  const spent = funds.reduce((s, f) => s + f.spent, 0);
  const unfundedSum = unfunded.reduce((s, t) => s + t.amount, 0);

  return (
    <>
      {funds.length === 0 ? (
        <div className="card empty-card">
          <CircleDollarSign size={36} strokeWidth={1.5} />
          <b>در این بازه پولی جابه‌جا نشده</b>
          <span className="muted small">هر درآمدی که تگ «پول» بخورد (مثلاً «حقوق») یک پول می‌شود و برای هر هزینه می‌توانی انتخاب کنی از کدام پول خرج شده.</span>
        </div>
      ) : (
        <>
          <div className="card summary">
            <div className="row">
              <div className="grow">
                <div className="muted small">خالص پول‌ها در {period.month ? "این ماه" : "این بازه"}</div>
                <Amount rial={income - spent} type={income - spent < 0 ? "expense" : undefined} className="net" />
              </div>
            </div>
            <div className="split">
              <div>
                <span className="muted small">ورودی</span>
                <Amount rial={income} className="income" />
              </div>
              <div>
                <span className="muted small">خرج شده از پول‌ها</span>
                <Amount rial={spent} className="expense" />
              </div>
            </div>
          </div>

          <div className="muted small hint">
            <Sparkles size={14} /> روی هر پول بزن تا هزینه‌هایش را در همین بازه ببینی
          </div>
          <div className="stack">
            {funds.map((f) => {
              const color = tags.find((t) => t.label === f.label && t.kind === "fund")?.color ?? "var(--primary)";
              const net = f.income - f.spent;
              const pct = f.income ? Math.min(100, (f.spent / f.income) * 100) : 100;
              return (
                <button key={f.label} type="button" className="card fund-row" style={{ "--c": color } as React.CSSProperties} onClick={() => setOpenFund(f.label)}>
                  <div className="row">
                    <span className="fund-icon">
                      <Wallet size={16} />
                    </span>
                    <span className="grow fund-name">{f.label}</span>
                    <ChevronLeft size={18} className="muted" />
                  </div>
                  <div className="row fund-row-nums">
                    <div className="grow">
                      <span className="muted small">ورودی</span>
                      <Amount rial={f.income} className="fund-left income" />
                    </div>
                    <div className="fund-row-side">
                      <span className="muted small">خرج شده</span>
                      <Amount rial={f.spent} className="expense" />
                    </div>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <span className={`small ${net < 0 ? "expense" : "muted"}`}>
                    خالص: <Amount rial={net} type={net < 0 ? "expense" : undefined} />
                    {f.income === 0 && " · ورودی این پول بیرون از این بازه بوده"}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {unfunded.length > 0 && (
        <button type="button" className="card fund-row unfunded" onClick={() => setOpenFund(null)}>
          <div className="row">
            <span className="fund-icon">
              <CircleDollarSign size={16} />
            </span>
            <span className="grow fund-name">بدون پول</span>
            <span className="muted small">{faNum(unfunded.length)} هزینه</span>
            <ChevronLeft size={18} className="muted" />
          </div>
          <Amount rial={unfundedSum} className="fund-left" />
          <span className="muted small">هزینه‌های این بازه که از هیچ پولی پرداخت نشده‌اند</span>
        </button>
      )}

      {openFund !== undefined && <FundSheet label={openFund} from={from} to={to} rangeLabel={period.label} onClose={() => setOpenFund(undefined)} />}
    </>
  );
}
