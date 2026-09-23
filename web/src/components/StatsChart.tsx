import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatToman, rialToToman } from "../lib/format";

export interface TagBucket {
  label: string;
  color: string;
  amount: number; // Rial
}

const compact = new Intl.NumberFormat("fa-IR", { notation: "compact" });

export default function StatsChart({ data }: { data: TagBucket[] }) {
  if (data.length === 0) return <p className="muted">داده‌ای برای این بازه نیست.</p>;
  const height = Math.max(160, data.length * 36);
  return (
    <div dir="ltr" style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <XAxis type="number" tickFormatter={(v: number) => compact.format(rialToToman(v))} fontSize={12} />
          <YAxis type="category" dataKey="label" width={90} orientation="right" fontSize={13} />
          <Tooltip formatter={(v) => formatToman(Number(v))} cursor={{ fillOpacity: 0.1 }} />
          <Bar dataKey="amount" radius={[4, 4, 4, 4]}>
            {data.map((d) => (
              <Cell key={d.label} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
