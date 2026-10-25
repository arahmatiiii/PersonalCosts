import { describe, expect, it } from "vitest";
import type { Transaction } from "../types";
import { allFunds } from "./funds";
import { addMonths, fromJalali, monthLength, monthRange, toJalali } from "./jalali";

describe("jalali", () => {
  it("converts known dates both ways", () => {
    expect(toJalali(new Date(2026, 2, 21))).toEqual({ jy: 1405, jm: 1, jd: 1 }); // Nowruz 1405
    expect(toJalali(new Date(2026, 8, 23))).toEqual({ jy: 1405, jm: 7, jd: 1 });
    expect(fromJalali(1405, 7, 1)).toEqual(new Date(2026, 8, 23));
    expect(toJalali(new Date(2025, 2, 20))).toEqual({ jy: 1403, jm: 12, jd: 30 }); // 1403 is leap
  });

  it("month helpers", () => {
    expect(monthLength(1405, 1)).toBe(31);
    expect(monthLength(1405, 7)).toBe(30);
    expect(addMonths({ jy: 1405, jm: 12 }, 1)).toEqual({ jy: 1406, jm: 1 });
    expect(addMonths({ jy: 1405, jm: 1 }, -1)).toEqual({ jy: 1404, jm: 12 });
    const [from, to] = monthRange({ jy: 1405, jm: 7 });
    expect(new Date(from)).toEqual(new Date(2026, 8, 23));
    expect(new Date(to + 1)).toEqual(new Date(2026, 9, 23));
  });
});

const tx = (over: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(),
  amount: 1000,
  type: "expense",
  bankId: "cash",
  timestamp: new Date(2026, 8, 25).getTime(),
  rawText: "",
  source: "manual",
  tag: null,
  note: null,
  tagged: true,
  typeUncertain: false,
  createdAt: 0,
  ...over,
});

describe("funds", () => {
  const salary = tx({ type: "income", tag: "حقوق", amount: 100_000 });
  const oldSalary = tx({ type: "income", tag: "حقوق", amount: 999, timestamp: new Date(2026, 7, 1).getTime() });

  it("sums all tagged incomes and subtracts expenses paid from them", () => {
    const all = [salary, oldSalary, tx({ fund: "حقوق", amount: 30_000 }), tx({ fund: "حقوق", amount: 5, timestamp: new Date(2026, 7, 2).getTime() })];
    expect(allFunds(all)).toEqual([{ label: "حقوق", total: 100_999, spent: 30_005, remaining: 70_994 }]);
  });
});