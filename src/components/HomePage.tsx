import { ChevronLeft, Inbox, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { faNum, rialToToman, startOfDay } from "../lib/format";
import { fundsForMonth } from "../lib/funds";
import { monthLabel, monthOf, monthRange, MONTHS, toJalali } from "../lib/jalali";
import { useStore } from "../store/useStore";
import AddSheet from "./AddSheet";
import Amount from "./Amount";
import FundCards from "./FundCards";
import ReviewCard from "./ReviewCard";
import TransactionRow from "./TransactionRow";
import TransactionSheet from "./TransactionSheet";
import WeekBars from "./WeekBars";

const WEEKDAY = new Intl.DateTimeFormat("fa-IR", { weekday: "long" });

export default function HomePage() {
  const { transactions, banks, tags, setActiveTab } = useStore();
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const now = new Date();
  const month = monthOf(now);
  const [mFrom] = monthRange(month);
  const todayStart = startOfDay(now).getTime();
  const { jd, jm } = toJalali(now);

  const bankById = useMemo(() => new Map(banks.map((b) => [b.id, b])), [banks]);
  const sorted = useMemo(() => [...transactions].sort((a, b) => b.timestamp - a.timestamp), [transactions]);
  const monthTx = sorted.filter((t) => t.timestamp >= mFrom);
  const monthSpent = monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const todaySpent = monthTx.filter((t) => t.type === "expense" && t.timestamp >= todayStart).reduce((s, t) => s + t.amount, 0);
  const funds = useMemo(() => fundsForMonth(transactions, month), [transactions, month.jy, month.jm]); // eslint-disable-line react-hooks/exhaustive-deps
  const fundsLeft = funds.reduce((s, f) => s + f.remaining, 0);
  const untagged = sorted.filter((t) => !t.tagged).reverse(); // oldest first
  const recent = sorted.slice(0, 5);

  const topTags = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of monthTx) if (t.type === "expense" && t.tag) m.set(t.tag, (m.get(t.tag) ?? 0) + t.amount);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [monthTx]);

  const open = openId ? transactions.find((t) => t.id === openId) : undefined;

  return (
    <>
      <header className="home-head">
        <div>
          <div className="muted small">{WEEKDAY.format(now)}</div>
          <div className="home-date">
            {faNum(jd)} {MONTHS[jm - 1]}
          </div>
        </div>
      </header>

      <div className="hero">
        <span className="label">خرج {monthLabel(month)}</span>
        <span className="value num">
          {faNum(rialToToman(monthSpent))}
          <small>تومان</small>
        </span>
        <div className="hero-stats">
          <div>
            <span>امروز</span>
            <b className="num">{faNum(rialToToman(todaySpent))}</b>
          </div>
          {funds.length > 0 && (
            <div>
              <span>مانده‌ی پول‌ها</span>
              <b className="num">{faNum(rialToToman(fundsLeft))}</b>
            </div>
          )}
        </div>
        <WeekBars transactions={transactions} />
      </div>

      <ReviewCard items={untagged} />

      {funds.length > 0 && (
        <section>
          <div className="section-title">پول‌ها</div>
          <FundCards funds={funds} tags={tags} />
        </section>
      )}

      {topTags.length > 0 && (
        <section>
          <div className="section-title">بیشترین خرج این ماه</div>
          <div className="top-tags">
            {topTags.map(([label, amount], i) => {
              const color = tags.find((t) => t.label === label)?.color ?? "var(--muted)";
              return (
                <div key={label} className="card top-tag" style={{ "--c": color } as React.CSSProperties}>
                  <span className="top-rank">{faNum(i + 1)}</span>
                  <span className="top-name">{label}</span>
                  <Amount rial={amount} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <div className="section-head">
          <span className="section-title">اخیر</span>
          {sorted.length > recent.length && (
            <button type="button" className="link-btn" onClick={() => setActiveTab("history")}>
              همه <ChevronLeft size={16} />
            </button>
          )}
        </div>
        {recent.length ? (
          <div className="card tx-group">
            {recent.map((t) => (
              <TransactionRow key={t.id} tx={t} bank={bankById.get(t.bankId)} tags={tags} showDate={t.timestamp < todayStart} onOpen={() => setOpenId(t.id)} />
            ))}
          </div>
        ) : (
          <div className="empty">
            <Inbox size={36} strokeWidth={1.5} />
            <span>هنوز تراکنشی نیست</span>
          </div>
        )}
      </section>

      <button type="button" className="fab" onClick={() => setAdding(true)} aria-label="افزودن">
        <Plus size={26} />
      </button>
      {adding && <AddSheet onClose={() => setAdding(false)} />}
      {open && <TransactionSheet key={open.id} tx={open} onClose={() => setOpenId(null)} />}
    </>
  );
}
