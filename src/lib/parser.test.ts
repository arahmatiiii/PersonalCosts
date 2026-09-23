import { describe, expect, it } from "vitest";
import { normalizeSender, parse } from "./parser";

describe("parse", () => {
  it("Melli-style: signed amount after label, balance ignored", () => {
    expect(parse("بانک ملی\nبرداشت:1,250,000-\nمانده:8,300,000\n0701-12:30")).toEqual({
      amount: 1250000,
      type: "expense",
      typeUncertain: false,
    });
  });

  it("Mellat-style income with + sign and Persian digits", () => {
    expect(parse("حساب ۱۲۳۴*\nواریز\n+۲٬۵۰۰٬۰۰۰\nمانده: ۱۰٬۰۰۰٬۰۰۰\n۱۴۰۵/۰۷/۰۱")).toEqual({
      amount: 2500000,
      type: "income",
      typeUncertain: false,
    });
  });

  it("amount next to مبلغ with ریال, keyword decides type", () => {
    expect(parse("خرید از فروشگاه مبلغ: 350,000 ريال موجودی 1,000,000 ريال")).toEqual({
      amount: 350000,
      type: "expense",
      typeUncertain: false,
    });
  });

  it("converts Toman to Rial", () => {
    expect(parse("واریز 120,000 تومان به حساب شما")).toMatchObject({ amount: 1200000, type: "income" });
  });

  it("ignores dates, times and card numbers", () => {
    expect(parse("کارت 6037991234567890 تاریخ 1405/07/01 ساعت 12:45 خرید 90,000 ریال")).toMatchObject({ amount: 90000 });
  });

  it("flags unclear type instead of guessing silently", () => {
    expect(parse("تراکنش 10,000 ريال")).toEqual({ amount: 10000, type: "expense", typeUncertain: true });
  });

  it("returns null when there is no amount (e.g. OTP)", () => {
    expect(parse("رمز پویا: 123456")).toBeNull();
    expect(parse("سلام")).toBeNull();
  });
});

describe("normalizeSender", () => {
  it("treats Iranian number formats as equal", () => {
    const n = normalizeSender("+989991234567");
    expect(normalizeSender("00989991234567")).toBe(n);
    expect(normalizeSender("09991234567")).toBe(n);
    expect(normalizeSender("+98 999 123 4567")).toBe(n);
    expect(normalizeSender("۰۹۹۹۱۲۳۴۵۶۷")).toBe(n);
    expect(normalizeSender("BluBank")).toBe("blubank");
  });
});
