import { ArrowDownLeft, CalendarClock, CircleDollarSign, Gauge, TrendingDown, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { faNum, rialToToman } from "../lib/format";
import { fundInRange, tagBreakdown, UNTAGGED, unfundedExpenses } from "../lib/stats";
import { useStore } from "../store/useStore";
import Amount from "./Amount";
import { Donut, FlowChart, SliceList } from "./Charts";
import Sheet from "./Sheet";
import TransactionRow from "./TransactionRow";
import TransactionSheet from "./TransactionSheet";

interface Props {
  /** The «پول» to show; null shows the range's expenses that no pot paid for. */
  label: string | null;
  from: number;
  to: number;
  rangeLabel: string;
  onClose: () => void;
}

/** One «پول» over a date range: what came in, what was paid from it, where it went and every expense. */
export default function FundSheet({ label, from, to, rangeLabel, onClose }: Props) {
  const { transactions, tags, banks } = useStore();
  const [selTags, setSelTags] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const bankById = useMemo(() => new Map(banks.map((b) => [b.id, b])), [banks]);

  const detail = useMemo(() => (label ? fundInRange(transactions, label, from, to) : null), [transactions, label, from, to]);
  const expenses = useMemo(() => detail?.expenses ?? unfundedExpenses(transactions, from, to), [detail, transactions, from, to]);
  const slices = useMemo(() => tagBreakdown(expenses, tags), [expenses, tags]);
  const shown = selTags.length ? expenses.filter((t) => selTags.includes(t.tag ?? UNTAGGED)) : expenses;
  const spent = expenses.reduce((s, t) => s + t.amount, 0);
  const color = (label && tags.find((t) => t.label === label && t.kind === "fund")?.color) || "var(--primary)";
  const open = openId ? transactions.find((t) => t.id === openId) : undefined;
  const toggle = (l: string) => setSelTags((s) => (s.includes(l) ? s.filter((x) => x !== l) : [...s, l]));
  const net = detail ? detail.income - detail.spent : 0;
  const pct = detail && detail.income ? Math.min(100, (detail.spent / detail.income) * 100) : 0;

  return (
    <Sheet
      title={
        <span className="row" style={{ gap: 8 }}>
          <span className="fund-icon" style={{ "--c": color } as React.CSSProperties}>
            {label ? <Wallet size={16} /> : <CircleDollarSign size={16} />}
          </span>
          <span className="stack" style={{ gap: 0 }}>
            {label ?? "بدون پول"}
            <span className="muted small" style={{ fontWeight: 400 }}>
              {rangeLabel}
            </span>
          </span>
        </span>
      }
      onClose={onClose}
    >
      {detail ? (
        <>
          <div className="fund-hero" style={{ "--c": color } as React.CSSProperties}>
            <span className="muted small">خالص این بازه (ورودی − خرج)</span>
            <Amount rial={net} type={net >= 0 ? undefined : "expense"} className={`fund-hero-left${net < 0 ? " expense" : ""}`} />
            {detail.income > 0 && (
              <>
                <div className="bar-track thick">
                  <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
                </div>
                <span className="small muted">{faNum(Math.round(pct))}٪ از ورودی این بازه خرج شده</span>
              </>
            )}
          </div>

          <div className="stat-grid">
            <div className="stat">
              <ArrowDownLeft size={16} />
              <span className="muted small">ورودی</span>
              <Amount rial={detail.income} className="income" />
            </div>
            <div className="stat">
              <TrendingDown size={16} />
              <span className="muted small">خرج شده</span>
              <Amount rial={detail.spent} />
            </div>
            <div className="stat">
              <Gauge size={16} />
              <span className="muted small">میانگین خرج روزانه</span>
              <Amount rial={Math.round(detail.perDay)} />
            </div>
            <div className="stat">
              <CalendarClock size={16} />
              <span className="muted small">{detail.daysLeft > 0 ? "روزهای باقی‌مانده" : "تعداد هزینه"}</span>
              <b className="num">{faNum(detail.daysLeft > 0 ? detail.daysLeft : detail.expenses.length)}</b>
            </div>
            {detail.daysLeft > 0 && net > 0 && (
              <div className="stat wide ok">
                <span className="small">
                  تا پایان بازه روزی <Amount rial={Math.round(net / detail.daysLeft)} /> می‌توانی از این پول خرج کنی
                </span>
              </div>
            )}
          </div>

          {detail.flow.length > 1 && (
            <section>
              <div className="section-title">روند مانده در این بازه</div>
              <div className="card-soft">
                <FlowChart points={detail.flow} end={Math.min(Date.now(), to)} />
              </div>
            </section>
          )}
        </>
      ) : (
        <div className="fund-hero">
          <span className="muted small">هزینه‌هایی که از هیچ پولی پرداخت نشده‌اند</span>
          <Amount rial={spent} className="fund-hero-left expense" />
          <span className="muted small">برای هر هزینه می‌توانی در صفحه‌اش «از» یک پول را انتخاب کنی.</span>
        </div>
      )}

      {slices.length > 0 && (
        <section>
          <div className="section-title">کجا خرج شد</div>
          <div className="donut-wrap">
            <Donut slices={slices}>
              <span className="muted small">{faNum(expenses.length)} هزینه</span>
              <b className="num">{faNum(rialToToman(spent))}</b>
              <span className="muted small">تومان</span>
            </Donut>
            <SliceList slices={slices} active={selTags} onPick={toggle} />
          </div>
        </section>
      )}

      {detail && detail.incomes.length > 0 && (
        <section>
          <div className="section-title">ورودی‌ها</div>
          <div className="card-soft tx-group">
            {detail.incomes.map((t) => (
              <TransactionRow key={t.id} tx={t} bank={bankById.get(t.bankId)} tags={tags} showDate onOpen={() => setOpenId(t.id)} />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="section-title">
          هزینه‌ها <span className="num">({faNum(shown.length)})</span>
        </div>
        {shown.length ? (
          <div className="card-soft tx-group">
            {shown.map((t) => (
              <TransactionRow key={t.id} tx={t} bank={bankById.get(t.bankId)} tags={tags} showDate onOpen={() => setOpenId(t.id)} />
            ))}
          </div>
        ) : (
          <div className="empty small">در این بازه هزینه‌ای از این پول نشده</div>
        )}
      </section>

      {open && <TransactionSheet key={open.id} tx={open} onClose={() => setOpenId(null)} />}
    </Sheet>
  );
}
