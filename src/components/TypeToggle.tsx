import type { TxType } from "../types";

export default function TypeToggle({ value, onChange }: { value: TxType; onChange: (t: TxType) => void }) {
  return (
    <div className="seg">
      <button type="button" className={value === "expense" ? "on expense" : ""} onClick={() => onChange("expense")}>
        هزینه
      </button>
      <button type="button" className={value === "income" ? "on income" : ""} onClick={() => onChange("income")}>
        درآمد
      </button>
    </div>
  );
}
