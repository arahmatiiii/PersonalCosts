import { CalendarClock, Gauge, TrendingDown, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { faNum, rialToToman } from "../lib/format";
import { MONTHS, monthRange, toJalali, type JMonth } from "../lib/jalali";
import { fundDetail, tagBreakdown, UNTAGGED, unfundedExpenses } from "../lib/stats";
import { useStore } from "../store/useStore";
import Amount from "./Amount";
import { BurnChart, Donut, SliceList } from "./Charts";
import Sheet from "./Sheet";
import TransactionRow from "./TransactionRow";
import TransactionSheet from "./TransactionSheet";

/**
 * One «پول» in detail: what's left, how fast it's going, where it went (by tag) and every expense
 * paid from it. `label` null shows the month's expenses that no pot paid for.
 */
export default function FundSheet({ label, month, onClose }: { label: string | null; month: JMonth; onClose: () => void }) {
  const { transactions, tags, banks } = useStore();
  const [selTags, setSelTags] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const bankById = useMemo(() => new Map(banks.map((b) => [b.id, b])), [banks]);

  const detail = useMemo(() => (label ? fundDetail(transactions, label, month) : null), [transactions, label, month]);
  const expenses = useMemo(() => (label ? (detail?.expenses ?? []) : unfundedExpenses(transactions, month)), [label, detail, transactions, month]);
  const slices = useMemo(() => tagBreakdown(expenses, tags), [expenses, tags]);
  const shown = selTags.length ? expenses.filter((t) => selTags.includes(t.tag ?? UNTAGGED)) : expenses;
  const spent = expenses.reduce((s, t) => s + t.amount, 0);
  const color = (label && tags.find((t) => t.label === label)?.color) || "var(--primary)";
  const open = openId ? transactions.find((t) => t.id === openId) : undefined;
  const toggle = (l: string) => setSelTags((s) => (s.includes(l) ? s.filter((x) => x !== l) : [...s, l]));
  const title = `${label ?? "بدون پول"} ${MONTHS[month.jm - 1]}`;

  if (label && !detail) {
    return (
      <Sheet title={title} onClose={onClose}>
        <div className="empty">این پول دیگر وجود ندارد</div>
      </Sheet>
    );
  }

  const f = detail?.fund;
  const pct = f && f.total ? Math.min(100, (f.spent / f.total) * 100) : 0;
  const dayOf = (t: number) => {
    const j = toJalali(new Date(t));
    return `${faNum(j.jd)} ${MONTHS[j.jm - 1]}`;
  };

  return (
    <Sheet
      title={
        <span className="row" style={{ gap: 8 }}>
          <span className="fund-icon" style={{ "--c": color } as React.CSSProperties}>
            <Wallet size={16} />
          </span>
          {title}
        </span>
      }
      onClose={onClose}
    >
      {f && detail ? (
        <>
          <div className="fund-hero" style={{ "--c": color } as React.CSSProperties}>
            <span className="muted small">مانده</span>
            <Amount rial={f.remaining} className={`fund-hero-left${f.remaining < 0 ? " expense" : ""}`} />
            <div className="bar-track thick">
              <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
            </div>
            <div className="row small muted">
              <span className="grow">
                {faNum(Math.round(pct))}٪ خرج شده
              </span>
              <span>
                از <Amount rial={f.total} />
              </span>
            </div>
          </div>

          <div className="stat-grid">
            <div className="stat">
              <TrendingDown size={16} />
              <span className="muted small">خرج شده</span>
              <Amount rial={f.spent} />
            </div>
            <div className="stat">
              <Gauge size={16} />
              <span className="muted small">میانگین روزانه</span>
              <Amount rial={Math.round(detail.perDay)} />
            </div>
            {detail.daysLeftInMonth > 0 && (
              <div className={`stat wide${detail.runsOutAt ? " warn" : " ok"}`}>
                <CalendarClock size={16} />
                <span className="small">
                  {f.remaining <= 0
                    ? "این پول تمام شده"
                    : detail.runsOutAt
                      ? `با این سرعت حدود ${dayOf(detail.runsOutAt)} تمام می‌شود`
                      : `با این سرعت تا آخر ماه کافی است (${faNum(detail.daysLeftInMonth)} روز مانده)`}
                </span>
                {f.remaining > 0 && detail.daysLeftInMonth > 0 && (
                  <span className="small muted">
                    روزی <Amount rial={Math.round(f.remaining / detail.daysLeftInMonth)} /> می‌توانی خرج کنی
                  </span>
                )}
              </div>
            )}
          </div>

          <section>
            <div className="section-title">روند مانده</div>
            <div className="card-soft">
              <BurnChart points={detail.burn} total={f.total} end={Math.min(Date.now(), monthRange(month)[1])} />
            </div>
          </section>
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
          <div className="empty small">هنوز هزینه‌ای از این پول نشده</div>
        )}
      </section>

      {open && <TransactionSheet key={open.id} tx={open} onClose={() => setOpenId(null)} />}
    </Sheet>
  );
}
