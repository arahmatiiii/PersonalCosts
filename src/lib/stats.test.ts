import { describe, expect, it } from "vitest";
import type { Transaction } from "../types";
import { fromJalali } from "./jalali";
import { change, fundDetail, inTodaysMoney, monthlyTotals, unfundedExpenses, yearSummary } from "./stats";

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
const mehr = { jy: 1405, jm: 7 };

describe("fundDetail", () => {
  const data = [
    tx({ type: "income", tag: "حقوق", amount: 30_000, timestamp: at(7, 1) }),
    tx({ amount: 5_000, tag: "خوراک", fund: "حقوق", fundMonth: "1405-7", timestamp: at(7, 3) }),
    tx({ amount: 2_000, tag: "اسنپ", fund: "حقوق", fundMonth: "1405-7", timestamp: at(7, 5) }),
    // paid from Mehr's pot although dated in Shahrivar
    tx({ amount: 1_000, tag: "خوراک", fund: "حقوق", fundMonth: "1405-7", timestamp: at(6, 30) }),
    tx({ amount: 9_999, tag: "خوراک", timestamp: at(7, 6) }),
  ];

  it("collects the pot's incomes and expenses and its balance over time", () => {
    const d = fundDetail(data, "حقوق", mehr, at(7, 10))!;
    expect(d.fund).toMatchObject({ total: 30_000, spent: 8_000, remaining: 22_000 });
    expect(d.expenses.map((e) => e.amount)).toEqual([2_000, 5_000, 1_000]);
    expect(d.burn.map((b) => b.remaining)).toEqual([-1_000, 29_000, 24_000, 22_000]);
  });

  it("projects when a current-month pot runs out", () => {
    const d = fundDetail(data, "حقوق", mehr, at(7, 2))!;
    expect(d.runsOutAt).not.toBeNull();
    expect(fundDetail(data, "حقوق", mehr, at(7, 29))!.runsOutAt).toBeNull();
  });

  it("returns null for an unknown pot and lists unfunded expenses", () => {
    expect(fundDetail(data, "نیست", mehr)).toBeNull();
    expect(unfundedExpenses(data, mehr).map((t) => t.amount)).toEqual([9_999]);
  });
});

describe("trends and inflation", () => {
  it("totals months oldest first", () => {
    const t = monthlyTotals([tx({ timestamp: at(6, 2), amount: 7 }), tx({ timestamp: at(7, 2), amount: 3, type: "income" })], mehr, 3);
    expect(t.map((m) => [m.month.jm, m.expense, m.income])).toEqual([
      [5, 0, 0],
      [6, 7, 0],
      [7, 0, 3],
    ]);
  });

  it("brings old amounts to today's money", () => {
    expect(inTodaysMoney(100, 12, 40)).toBeCloseTo(140);
    const c = change(140, 100, 12, 40)!;
    expect(c.nominal).toBeCloseTo(0.4);
    expect(c.real).toBeCloseTo(0);
    expect(change(1, 0, 1, 40)).toBeNull();
  });

  it("summarises a Jalali year", () => {
    const s = yearSummary([tx({ timestamp: at(2, 1), amount: 50, tag: "خرید" }), tx({ timestamp: at(3, 1), amount: 10, tag: "خوراک" })], 1405, []);
    expect(s).toMatchObject({ expense: 60, count: 2 });
    expect(s.topTag?.label).toBe("خرید");
    expect(s.topMonth?.month.jm).toBe(2);
  });
});
