import { fromJalali, monthLength, MONTHS, toJalali } from "../lib/jalali";

const fa = (n: number) => n.toLocaleString("fa-IR", { useGrouping: false });

/** Jalali day / month / year selects. Value is a local-midnight Date. */
export default function DatePicker({ value, onChange, maxDate = new Date() }: { value: Date; onChange: (d: Date) => void; maxDate?: Date }) {
  const { jy, jm, jd } = toJalali(value);
  const maxY = toJalali(maxDate).jy;
  const years = Array.from({ length: 6 }, (_, i) => maxY - i);
  const set = (y: number, m: number, d: number) => onChange(fromJalali(y, m, Math.min(d, monthLength(y, m))));

  return (
    <div className="date-pick">
      <select value={jd} onChange={(e) => set(jy, jm, Number(e.target.value))} aria-label="روز">
        {Array.from({ length: monthLength(jy, jm) }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {fa(d)}
          </option>
        ))}
      </select>
      <select value={jm} onChange={(e) => set(jy, Number(e.target.value), jd)} aria-label="ماه">
        {MONTHS.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
      <select value={jy} onChange={(e) => set(Number(e.target.value), jm, jd)} aria-label="سال">
        {years.map((y) => (
          <option key={y} value={y}>
            {fa(y)}
          </option>
        ))}
      </select>
    </div>
  );
}
