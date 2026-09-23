import { faNum, rialToToman } from "../lib/format";
import type { TxType } from "../types";

/** Toman amount with a small unit; signed and coloured when a type is given. */
export default function Amount({ rial, type, className = "" }: { rial: number; type?: TxType; className?: string }) {
  const sign = type === "income" ? "+" : type === "expense" && rial !== 0 ? "−" : "";
  return (
    <span className={`amount num ${type ?? ""} ${className}`}>
      <bdi dir="ltr">
        {sign}
        {faNum(rialToToman(Math.abs(rial)))}
      </bdi>
      <span className="unit">تومان</span>
    </span>
  );
}
