import { describe, expect, it } from "vitest";
import { parse } from "./parser";

const bank = {
  regexAmount: "([\\d,]+)\\s*ريال",
  incomeKeywords: ["واریز", "افزایش موجودی"],
  expenseKeywords: ["خرید", "برداشت", "کسر"],
};

describe("parse", () => {
  it("parses an expense with ASCII digits", () => {
    const r = parse(bank, "خرید از فروشگاه مبلغ 1,250,000 ريال");
    expect(r).toEqual({ ok: true, result: { amount: 1250000, type: "expense", typeUncertain: false } });
  });

  it("normalizes Persian digits, Persian separators and Persian yeh in ریال", () => {
    const r = parse(bank, "واریز ۲٬۵۰۰٬۰۰۰ ریال به حساب شما");
    expect(r).toEqual({ ok: true, result: { amount: 2500000, type: "income", typeUncertain: false } });
  });

  it("flags unclear type instead of silently guessing", () => {
    const r = parse(bank, "تراکنش 10,000 ريال");
    expect(r).toEqual({ ok: true, result: { amount: 10000, type: "expense", typeUncertain: true } });
  });

  it("returns an error when the regex doesn't match", () => {
    expect(parse(bank, "سلام").ok).toBe(false);
  });

  it("matches keywords across ZWNJ", () => {
    const r = parse(bank, "افزایش‌موجودی 5,000 ريال");
    expect(r.ok && r.result.type).toBe("income");
  });
});
