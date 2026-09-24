import { describe, expect, it } from "vitest";
import type { Transaction } from "../types";
import { autoFund, fundOptionsFor, fundsForMonth } from "./funds";
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

  it("sums a month's tagged incomes and subtracts expenses paid from them", () => {
    const all = [salary, oldSalary, tx({ fund: "حقوق", amount: 30_000 }), tx({ fund: "حقوق", amount: 5, timestamp: new Date(2026, 7, 2).getTime() })];
    expect(fundsForMonth(all, { jy: 1405, jm: 7 })).toEqual([{ label: "حقوق", total: 100_000, spent: 30_000, remaining: 70_000 }]);
  });

  it("auto-assigns a pot when the expense tag matches one that month", () => {
    expect(autoFund(tx({}), "حقوق", [salary])).toEqual({ fund: "حقوق", fundMonth: "1405-7" });
    expect(autoFund(tx({}), "اسنپ", [salary]).fund).toBeNull();
    expect(autoFund(tx({ fund: "پس‌انداز", fundMonth: "1405-6" }), "حقوق", [salary])).toEqual({ fund: "پس‌انداز", fundMonth: "1405-6" });
    expect(autoFund(tx({ timestamp: new Date(2026, 7, 5).getTime() }), "حقوق", [salary]).fund).toBeNull();
  });

  it("lets an expense be paid from a pot of a nearby month", () => {
    const shahrivarBuy = tx({ timestamp: new Date(2026, 8, 20).getTime(), amount: 40_000 }); // 29 Shahrivar
    const opts = fundOptionsFor(shahrivarBuy, [salary, oldSalary]);
    expect(opts.map((o) => o.key)).toEqual(["1405-7", "1405-5"]); // Mehr's pot offered for a Shahrivar purchase
    const paid = { ...shahrivarBuy, fund: "حقوق", fundMonth: "1405-7" };
    expect(fundsForMonth([salary, paid], { jy: 1405, jm: 7 })[0]).toMatchObject({ spent: 40_000, remaining: 60_000 });
  });
});
