import { describe, expect, it } from "vitest";
import { splitTagKinds } from "../store/useStore";
import type { Transaction } from "../types";
import { fromJalali } from "./jalali";
import { fundInRange, fundsInRange, unfundedExpenses } from "./stats";

let n = 0;
const tx = (over: Partial<Transaction>): Transaction => ({
  id: String(n++),
  amount: 1000,
  type: "expense",
  bankId: "b",
  timestamp: 0,
  rawText: "",
  source: "manual",
  tag: null,
  note: null,
  tagged: true,
  typeUncertain: false,
  createdAt: 0,
  ...over,
});
const at = (jm: number, jd: number, h = 12) => fromJalali(1405, jm, jd).getTime() + h * 3_600_000;
const day = (jm: number, jd: number) => fromJalali(1405, jm, jd).getTime();

const data = [
  tx({ type: "income", tag: "حقوق", amount: 30_000, timestamp: at(6, 1) }),
  tx({ type: "income", tag: "حقوق", amount: 31_000, timestamp: at(7, 1) }),
  tx({ amount: 5_000, tag: "خوراک", fund: "حقوق", fundMonth: "1405-7", timestamp: at(7, 3) }),
  tx({ amount: 2_000, tag: "اسنپ", fund: "حقوق", fundMonth: "1405-7", timestamp: at(7, 5) }),
  tx({ amount: 1_000, tag: "خوراک", fund: "حقوق", fundMonth: "1405-7", timestamp: at(6, 30) }),
  tx({ amount: 4_000, tag: "خرید", fund: "پروژه", fundMonth: "1405-6", timestamp: at(6, 20) }),
  tx({ amount: 9_999, tag: "خوراک", timestamp: at(7, 6) }),
];

describe("pots over any range", () => {
  it("sums what came in and went out of each pot inside the range", () => {
    // 25 Shahrivar → 10 Mehr
    const r = fundsInRange(data, day(6, 25), day(7, 10) - 1);
    expect(r).toEqual([{ label: "حقوق", income: 31_000, spent: 8_000 }]);
    // the whole of Shahrivar + Mehr: two salaries, plus the «پروژه» pot that only had spending
    const all = fundsInRange(data, day(6, 1), day(8, 1) - 1);
    expect(all.find((f) => f.label === "حقوق")).toMatchObject({ income: 61_000, spent: 8_000 });
    expect(all.find((f) => f.label === "پروژه")).toMatchObject({ income: 0, spent: 4_000 });
  });

  it("details one pot: entries, newest-first expenses, running balance and pace", () => {
    const d = fundInRange(data, "حقوق", day(6, 25), day(7, 10) - 1, at(7, 6));
    expect(d.expenses.map((e) => e.amount)).toEqual([2_000, 5_000, 1_000]);
    expect(d.flow.map((f) => f.balance)).toEqual([-1_000, 30_000, 25_000, 23_000]);
    expect(d.daysLeft).toBeGreaterThan(0);
    expect(fundInRange(data, "حقوق", day(6, 25), day(7, 10) - 1, at(8, 1)).daysLeft).toBe(0);
  });

  it("lists unfunded expenses in the range", () => {
    expect(unfundedExpenses(data, day(7, 1), day(8, 1) - 1).map((t) => t.amount)).toEqual([9_999]);
  });
});

describe("splitTagKinds", () => {
  it("makes income tags «پول» tags and keeps a tag used on both as one of each", () => {
    const tags = [
      { id: "a", label: "حقوق", color: "#1" },
      { id: "b", label: "خوراک", color: "#2" },
      { id: "c", label: "هدیه", color: "#3" },
      { id: "d", label: "نو", color: "#4" },
    ];
    const txs = [tx({ type: "income", tag: "حقوق" }), tx({ tag: "خوراک" }), tx({ type: "income", tag: "هدیه" }), tx({ tag: "هدیه" })];
    expect(splitTagKinds(tags, txs).map((t) => `${t.label}:${t.kind}`)).toEqual(["حقوق:fund", "خوراک:expense", "هدیه:expense", "هدیه:fund", "نو:expense"]);
  });
});
