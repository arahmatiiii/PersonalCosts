import { useState, type ReactNode } from "react";
import { faNum, startOfDay } from "../lib/format";
import { fromJalali, monthLength, MONTHS, toJalali, type JMonth } from "../lib/jalali";
import type { TagSlice } from "../lib/stats";
import Amount from "./Amount";

/** Ring chart of tag slices with free content in the middle. */
export function Donut({ slices, children, size = 168 }: { slices: TagSlice[]; children?: ReactNode; size?: number }) {
  const r = 42;
  const C = 2 * Math.PI * r;
  const total = slices.reduce((s, x) => s + x.amount, 0) || 1;
  const gap = slices.length > 1 ? 1.2 : 0;
  let offset = 0;
  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r={r} className="donut-track" />
        {slices.map((s) => {
          const len = (s.amount / total) * C;
          const seg = (
            <circle
              key={s.label}
              cx="50"
              cy="50"
              r={r}
              stroke={s.color}
              strokeDasharray={`${Math.max(0, len - gap)} ${C}`}
              strokeDashoffset={-offset}
              className="donut-seg"
            />
          );
          offset += len;
          return seg;
        })}
      </svg>
      <div className="donut-center">{children}</div>
    </div>
  );
}

/** Legend rows under a donut: colour, label, share, amount — tappable. */
export function SliceList({ slices, active, onPick }: { slices: TagSlice[]; active?: string[]; onPick?: (label: string) => void }) {
  const total = slices.reduce((s, x) => s + x.amount, 0) || 1;
  return (
    <div className="slices">
      {slices.map((s) => {
        const pct = (s.amount / total) * 100;
        const on = !active?.length || active.includes(s.label);
        return (
          <button key={s.label} type="button" className={`slice${on ? "" : " off"}`} onClick={() => onPick?.(s.label)} disabled={!onPick}>
            <span className="dot" style={{ background: s.color }} />
            <span className="grow">{s.label}</span>
            <span className="muted small num">{faNum(Math.round(pct))}٪</span>
            <Amount rial={s.amount} />
            <span className="slice-bar" style={{ width: `${pct}%`, background: s.color }} />
          </button>
        );
      })}
    </div>
  );
}

const WEEK_HEAD = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

/** Jalali month calendar coloured by how much was spent each day. */
export function Heatmap({ month, daily }: { month: JMonth; daily: Map<number, number> }) {
  const [picked, setPicked] = useState<number | null>(null);
  const days = monthLength(month.jy, month.jm);
  const first = fromJalali(month.jy, month.jm, 1);
  const lead = (first.getDay() + 1) % 7; // Saturday-first week
  const today = startOfDay(new Date()).getTime();
  const max = Math.max(1, ...daily.values());
  const cells = Array.from({ length: days }, (_, i) => {
    const d = fromJalali(month.jy, month.jm, i + 1).getTime();
    return { jd: i + 1, d, amount: daily.get(d) ?? 0 };
  });
  const pickedCell = cells.find((c) => c.d === picked);

  return (
    <div className="heat">
      <div className="heat-grid">
        {WEEK_HEAD.map((w) => (
          <span key={w} className="heat-head">
            {w}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`l${i}`} />
        ))}
        {cells.map((c) => {
          const level = c.amount ? 0.18 + 0.82 * Math.sqrt(c.amount / max) : 0;
          return (
            <button
              key={c.jd}
              type="button"
              className={`heat-cell${c.d > today ? " future" : ""}${c.d === today ? " today" : ""}${c.d === picked ? " on" : ""}`}
              style={{ "--l": level } as React.CSSProperties}
              disabled={c.d > today}
              onClick={() => setPicked((p) => (p === c.d ? null : c.d))}
            >
              {faNum(c.jd)}
            </button>
          );
        })}
      </div>
      <div className="heat-foot small">
        {pickedCell ? (
          <>
            <span className="muted">
              {faNum(pickedCell.jd)} {MONTHS[month.jm - 1]}
            </span>
            <Amount rial={pickedCell.amount} />
          </>
        ) : (
          <>
            <span className="muted">کم</span>
            <span className="heat-scale" />
            <span className="muted">زیاد</span>
          </>
        )}
      </div>
    </div>
  );
}

/** A pot's running balance (in − out) over a range: a step line, time running right → left. */
export function FlowChart({ points, end }: { points: { t: number; balance: number }[]; end: number }) {
  if (points.length === 0) return null;
  const W = 300;
  const H = 120;
  const t0 = points[0].t;
  const t1 = Math.max(end, points[points.length - 1].t, t0 + 86_400_000);
  const lo = Math.min(0, ...points.map((p) => p.balance));
  const hi = Math.max(1, ...points.map((p) => p.balance));
  const x = (t: number) => W - ((t - t0) / (t1 - t0)) * W;
  const y = (v: number) => 6 + (1 - (v - lo) / (hi - lo)) * (H - 12);
  let prev = 0;
  let d = `M ${x(t0)} ${y(0)}`;
  for (const p of points) {
    d += ` L ${x(p.t)} ${y(prev)} L ${x(p.t)} ${y(p.balance)}`;
    prev = p.balance;
  }
  d += ` L ${x(t1)} ${y(prev)}`;
  const area = `${d} L ${x(t1)} ${y(lo)} L ${x(t0)} ${y(lo)} Z`;
  const fmt = (t: number) => {
    const j = toJalali(new Date(t));
    return `${faNum(j.jd)} ${MONTHS[j.jm - 1]}`;
  };
  return (
    <div className="burn">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
        <path d={area} className="burn-area" />
        {lo < 0 && <line x1="0" x2={W} y1={y(0)} y2={y(0)} className="burn-zero" vectorEffect="non-scaling-stroke" />}
        <path d={d} className="burn-line" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="burn-axis small muted">
        <span>{fmt(t0)}</span>
        <span>{fmt(t1)}</span>
      </div>
    </div>
  );
}
