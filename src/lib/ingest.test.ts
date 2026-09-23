import { describe, expect, it } from "vitest";
import type { Bank, Transaction } from "../types";
import { ingestCaptures, type Capture } from "./ingest";
import { normalizeSender } from "./parser";

const bank: Bank = {
  id: "blu",
  name: "بلوبانک",
  matchPackages: ["com.example.blu"],
  matchSenderIds: ["+989991234567"],
  regexAmount: "([\\d,]+)\\s*ريال",
  incomeKeywords: ["واریز"],
  expenseKeywords: ["خرید", "برداشت"],
  enabled: true,
  isDefault: true,
};

const cap = (over: Partial<Capture>): Capture => ({
  id: Math.random().toString(),
  source: "sms",
  origin: "09991234567",
  text: "خرید 120,000 ريال",
  ts: 1_000_000,
  ...over,
});

describe("ingestCaptures", () => {
  it("parses a matching SMS into an untagged transaction", () => {
    const { added, log } = ingestCaptures([cap({})], [bank], []);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ amount: 120000, type: "expense", bankId: "blu", source: "sms", tagged: false });
    expect(log[0].status).toMatch(/^SAVED/);
  });

  it("dedups an SMS + notification pair for the same transaction", () => {
    const { added, log } = ingestCaptures(
      [cap({}), cap({ source: "notification", origin: "com.example.blu", text: "بلو: خرید ۱۲۰٬۰۰۰ ریال", ts: 1_030_000 })],
      [bank],
      [],
    );
    expect(added).toHaveLength(1);
    expect(log[1].status).toMatch(/^DUPLICATE/);
  });

  it("keeps two identical purchases that are further apart than the window", () => {
    const { added } = ingestCaptures([cap({ ts: 0 }), cap({ ts: 10 * 60_000 })], [bank], []);
    expect(added).toHaveLength(2);
  });

  it("dedups against transactions already stored", () => {
    const existing = ingestCaptures([cap({})], [bank], []).added as Transaction[];
    expect(ingestCaptures([cap({ ts: 1_010_000 })], [bank], existing).added).toHaveLength(0);
  });

  it("logs unparsed bank messages and ignores disabled banks / unknown origins", () => {
    expect(ingestCaptures([cap({ text: "رمز یکبار مصرف: 1234" })], [bank], []).log[0].status).toMatch(/^UNPARSED/);
    expect(ingestCaptures([cap({})], [{ ...bank, enabled: false }], []).added).toHaveLength(0);
    expect(ingestCaptures([cap({ origin: "+98912000" })], [bank], []).log[0].status).toBe("SMS (no bank)");
  });
});

describe("normalizeSender", () => {
  it("treats Iranian number formats as equal", () => {
    const n = normalizeSender("+989991234567");
    expect(normalizeSender("00989991234567")).toBe(n);
    expect(normalizeSender("09991234567")).toBe(n);
    expect(normalizeSender("+98 999 123 4567")).toBe(n);
    expect(normalizeSender("BluBank")).toBe("blubank");
  });
});
