import { ChevronLeft, ChevronRight, CircleDollarSign, Search, Sparkles, Wallet, X } from "lucide-react";
import { useMemo, useState } from "react";
import { endOfDay, faNum, rialToToman, startOfDay, startOfWeek } from "../lib/format";
import { fundsForMonth } from "../lib/funds";
import { addMonths, MONTHS, monthLabel, monthOf, monthRange, type JMonth } from "../lib/jalali";
import { normalizeText } from "../lib/parser";
import { change, dailyExpense, inTodaysMoney, isCurrentMonth, monthlyTotals, monthsBetween, tagBreakdown, UNTAGGED, unfundedExpenses, yearSummary, type Change, type MonthTotal } from "../lib/stats";
import { useStore } from "../store/useStore";
import Amount from "./Amount";
import { Donut, Heatmap, SliceList, TrendBars } from "./Charts";
import DatePicker from "./DatePicker";
import FundSheet from "./FundSheet";
import TransactionRow from "./TransactionRow";
import TransactionSheet from "./TransactionSheet";

type View = "overview" | "funds" | "trend";
type Range = "week" | "month" | "custom";
type Kind = "all" | "expense" | "income";
const LIST_PAGE = 20;

function MonthNav({ month, setMonth }: { month: JMonth; setMonth: (f: (m: JMonth) => JMonth) => void }) {
  return (
    <div className="month-nav">
      <button type="button" className="icon-btn" aria-label="ماه قبل" onClick={() => setMonth((m) => addMonths(m, -1))}>
        <ChevronRight size={20} />
      </button>
      <span>{monthLabel(month)}</span>
      <button type="button" className="icon-btn" aria-label="ماه بعد" disabled={isCurrentMonth(month)} onClick={() => setMonth((m) => addMonths(m, 1))}>
        <ChevronLeft size={20} />
      </button>
    </div>
  );
}

export default function StatsPage() {
  const [view, setView] = useState<View>("overview");
  const [month, setMonth] = useState(() => monthOf(new Date()));

  return (
    <>
      <h1 className="page-title">آمار</h1>
      <div className="tabs" role="tablist">
        {(
          [
            ["overview", "کلی"],
            ["funds", "پول‌ها"],
            ["trend", "روند و تورم"],
          ] as const
        ).map(([v, label]) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? "on" : ""} onClick={() => setView(v)}>
            {label}
          </button>
        ))}
      </div>
      {view === "overview" ? <Overview month={month} setMonth={setMonth} /> : view === "funds" ? <Funds month={month} setMonth={setMonth} /> : <Trend />}
    </>
  );
}

// ------------------------------------------------------------------ کلی

function Overview({ month, setMonth }: { month: JMonth; setMonth: (f: (m: JMonth) => JMonth) => void }) {
  const { transactions, tags, banks } = useStore();
  const [range, setRange] = useState<Range>("month");
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
  const days = Math.max(1, Math.ceil((Math.min(Date.now(), to) - from) / 86_400_000));
  const allTagLabels = [...tags.map((t) => t.label), UNTAGGED];
  const open = openId ? transactions.find((t) => t.id === openId) : undefined;
  const toggleTag = (l: string) => setSelTags((s) => (s.includes(l) ? s.filter((x) => x !== l) : [...s, l]));
  const hasFilter = query || kind !== "all" || selTags.length > 0;

  return (
    <>
      <div className="seg">
        {(["week", "month", "custom"] as Range[]).map((r) => (
          <button key={r} type="button" className={range === r ? "on" : ""} onClick={() => setRange(r)}>
            {{ week: "این هفته", month: "ماه", custom: "بازه‌ی دلخواه" }[r]}
          </button>
        ))}
      </div>
      {range === "month" && <MonthNav month={month} setMonth={setMonth} />}
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

      {range === "month" && expense > 0 && (
        <section>
          <div className="section-title">تقویم خرج</div>
          <div className="card heat-card">
            <Heatmap month={month} daily={daily} />
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

function Funds({ month, setMonth }: { month: JMonth; setMonth: (f: (m: JMonth) => JMonth) => void }) {
  const { transactions, tags } = useStore();
  const [openFund, setOpenFund] = useState<string | null | undefined>(undefined);
  const funds = useMemo(() => fundsForMonth(transactions, month), [transactions, month]);
  const unfunded = useMemo(() => unfundedExpenses(transactions, month), [transactions, month]);
  const total = funds.reduce((s, f) => s + f.total, 0);
  const spent = funds.reduce((s, f) => s + f.spent, 0);
  const unfundedSum = unfunded.reduce((s, t) => s + t.amount, 0);

  return (
    <>
      <MonthNav month={month} setMonth={setMonth} />

      {funds.length === 0 ? (
        <div className="card empty-card">
          <CircleDollarSign size={36} strokeWidth={1.5} />
          <b>در {monthLabel(month)} پولی ثبت نشده</b>
          <span className="muted small">هر درآمدی که تگ بخورد (مثلاً «حقوق») یک «پول» این ماه می‌شود و می‌توانی هزینه‌ها را از آن پرداخت کنی.</span>
        </div>
      ) : (
        <>
          <div className="card summary">
            <div className="row">
              <div className="grow">
                <div className="muted small">مانده‌ی همه‌ی پول‌ها</div>
                <Amount rial={total - spent} className={`net${total - spent < 0 ? " expense" : ""}`} />
              </div>
            </div>
            <div className="split">
              <div>
                <span className="muted small">ورودی</span>
                <Amount rial={total} className="income" />
              </div>
              <div>
                <span className="muted small">خرج شده</span>
                <Amount rial={spent} className="expense" />
              </div>
            </div>
          </div>

          <div className="muted small hint">
            <Sparkles size={14} /> روی هر پول بزن تا ببینی کجا خرج شده
          </div>
          <div className="stack">
            {funds.map((f) => {
              const color = tags.find((t) => t.label === f.label)?.color ?? "var(--primary)";
              const pct = f.total ? Math.min(100, (f.spent / f.total) * 100) : 0;
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
                      <span className="muted small">مانده</span>
                      <Amount rial={f.remaining} className={`fund-left${f.remaining < 0 ? " expense" : ""}`} />
                    </div>
                    <div className="fund-row-side">
                      <span className="muted small">خرج شده</span>
                      <Amount rial={f.spent} />
                    </div>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <span className="muted small">
                    {faNum(Math.round(pct))}٪ از <Amount rial={f.total} />
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
          <span className="muted small">هزینه‌های این ماه که از هیچ پولی پرداخت نشده‌اند</span>
        </button>
      )}

      {openFund !== undefined && <FundSheet label={openFund} month={month} onClose={() => setOpenFund(undefined)} />}
    </>
  );
}

// ------------------------------------------------------------------ روند و تورم

const WEEKDAYS = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];

function pct(x: number): string {
  const v = Math.round(Math.abs(x) * 100);
  return `${faNum(v)}٪ ${x >= 0 ? "بیشتر" : "کمتر"}`;
}

function ChangeRow({ title, c, rate }: { title: string; c: Change | null; rate: number }) {
  if (!c) return null;
  return (
    <div className="change-row">
      <span className="muted small">{title}</span>
      <div className="change-vals">
        <span>
          اسمی <b className={c.nominal > 0 ? "expense" : "income"}>{pct(c.nominal)}</b>
        </span>
        <span>
          واقعی <b className={c.real > 0 ? "expense" : "income"}>{pct(c.real)}</b>
        </span>
      </div>
      <span className="muted small">
        {c.real <= 0 && c.nominal > 0
          ? "رقم بیشتر شده، ولی با حساب تورم در واقع کمتر خرج کرده‌ای."
          : c.real > 0
            ? `حتی با تورم ${faNum(rate)}٪ هم بیشتر خرج کرده‌ای.`
            : "هم اسمی و هم واقعی کمتر خرج کرده‌ای."}
      </span>
    </div>
  );
}

function Trend() {
  const { transactions, tags, settings, setActiveTab } = useStore();
  const rate = settings.inflationRate;
  const now = monthOf(new Date());
  const [real, setReal] = useState(false);
  const [sel, setSel] = useState(11);
  const [year, setYear] = useState(now.jy);

  // 15 months so the oldest bar still has three months before it to compare with
  const all = useMemo(() => monthlyTotals(transactions, now, 15), [transactions, now.jy, now.jm]); // eslint-disable-line react-hooks/exhaustive-deps
  const raw = all.slice(3);
  const data = useMemo(
    () =>
      real
        ? raw.map((m) => {
            const ago = monthsBetween(m.month, now);
            return { ...m, income: inTodaysMoney(m.income, ago, rate), expense: inTodaysMoney(m.expense, ago, rate) };
          })
        : raw,
    [raw, real, rate], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const s = data[sel];
  const selMonth = raw[sel].month;
  // Compare spending per day, so a month still in progress is compared fairly.
  const perDay = (m: MonthTotal) => {
    const [from, to] = monthRange(m.month);
    return m.expense / Math.max(1, Math.ceil((Math.min(Date.now(), to) - from) / 86_400_000));
  };
  const cur = perDay(all[sel + 3]);
  const lastYearTotal = useMemo(() => monthlyTotals(transactions, addMonths(selMonth, -12), 1)[0], [transactions, selMonth]);
  const lastYear = perDay(lastYearTotal);
  const avg3 = (perDay(all[sel]) + perDay(all[sel + 1]) + perDay(all[sel + 2])) / 3;
  const summary = useMemo(() => yearSummary(transactions, year, tags), [transactions, year, tags]);
  const saved = summary.income - summary.expense;
  const firstYear = useMemo(() => (transactions.length ? monthOf(Math.min(...transactions.map((t) => t.timestamp))).jy : now.jy), [transactions]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <section>
        <div className="section-head">
          <span className="section-title">۱۲ ماه اخیر</span>
          <label className="mini-switch">
            <span className="small">به ارزش امروز</span>
            <span className="switch">
              <input type="checkbox" checked={real} onChange={(e) => setReal(e.target.checked)} />
              <span />
            </span>
          </label>
        </div>
        <div className="card trend-card">
          <div className="trend-head">
            <b>{monthLabel(s.month)}</b>
            <div className="trend-legend small">
              <span>
                <i className="dot" style={{ background: "var(--income)" }} /> درآمد <Amount rial={Math.round(s.income)} />
              </span>
              <span>
                <i className="dot" style={{ background: "var(--expense)" }} /> هزینه <Amount rial={Math.round(s.expense)} />
              </span>
            </div>
          </div>
          <TrendBars data={data} selected={sel} onSelect={setSel} />
          {real && (
            <span className="muted small">
              مبالغ ماه‌های قبل با تورم سالانه‌ی {faNum(rate)}٪ به پول امروز تبدیل شده‌اند.{" "}
              <button type="button" className="inline-link" onClick={() => setActiveTab("settings")}>
                تغییر نرخ
              </button>
            </span>
          )}
        </div>
      </section>

      {(lastYear > 0 || avg3 > 0) && cur > 0 && (
        <section>
          <div className="section-title">خرج روزانه‌ی {monthLabel(selMonth)} در برابر…</div>
          <div className="card changes">
            <ChangeRow title={`${MONTHS[selMonth.jm - 1]} پارسال`} c={change(cur, lastYear, 12, rate)} rate={rate} />
            <ChangeRow title="میانگین ۳ ماه قبلش" c={change(cur, avg3, 2, rate)} rate={rate} />
            <span className="muted small">برای مقایسه‌ی ماه دیگر، روی ستونش در نمودار بزن.</span>
          </div>
        </section>
      )}

      <section>
        <div className="section-head">
          <span className="section-title">سال {faNum(year).replace(/٬/g, "")} در یک نگاه</span>
          <div className="row" style={{ gap: 0 }}>
            <button type="button" className="icon-btn" aria-label="سال قبل" disabled={year <= firstYear} onClick={() => setYear((y) => y - 1)}>
              <ChevronRight size={18} />
            </button>
            <button type="button" className="icon-btn" aria-label="سال بعد" disabled={year >= now.jy} onClick={() => setYear((y) => y + 1)}>
              <ChevronLeft size={18} />
            </button>
          </div>
        </div>
        {summary.count === 0 ? (
          <div className="empty small">در این سال تراکنشی نیست</div>
        ) : (
          <div className="year-grid">
            <div className="card year-cell">
              <span className="muted small">کل درآمد</span>
              <Amount rial={summary.income} className="income" />
            </div>
            <div className="card year-cell">
              <span className="muted small">کل هزینه</span>
              <Amount rial={summary.expense} className="expense" />
            </div>
            <div className="card year-cell wide">
              <span className="muted small">{saved >= 0 ? "پس‌انداز" : "کسری"}</span>
              <Amount rial={saved} type={saved >= 0 ? "income" : "expense"} className="year-big" />
              {summary.income > 0 && <span className="muted small">{faNum(Math.round((saved / summary.income) * 100))}٪ از درآمد</span>}
            </div>
            {summary.topTag && (
              <div className="card year-cell">
                <span className="muted small">بیشترین خرج</span>
                <b>{summary.topTag.label}</b>
                <Amount rial={summary.topTag.amount} />
              </div>
            )}
            {summary.topMonth && (
              <div className="card year-cell">
                <span className="muted small">پرخرج‌ترین ماه</span>
                <b>{MONTHS[summary.topMonth.month.jm - 1]}</b>
                <Amount rial={summary.topMonth.expense} />
              </div>
            )}
            {summary.biggest && (
              <div className="card year-cell">
                <span className="muted small">گران‌ترین خرید</span>
                <b>{summary.biggest.tag ?? summary.biggest.note ?? "بدون تگ"}</b>
                <Amount rial={summary.biggest.amount} />
              </div>
            )}
            {summary.busiestWeekday !== null && (
              <div className="card year-cell">
                <span className="muted small">پرخرج‌ترین روز هفته</span>
                <b>{WEEKDAYS[summary.busiestWeekday]}</b>
                <span className="muted small">{faNum(summary.count)} تراکنش در سال</span>
              </div>
            )}
          </div>
        )}
      </section>
    </>
  );
}
