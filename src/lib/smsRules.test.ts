import { describe, expect, it } from "vitest";
import type { Bank } from "../types";
import { readCaptures, rereadUnread } from "./ingest";
import { normalizeText, parse } from "./parser";
import { applyRules, learnRule, numberTokens } from "./smsRules";

/** Teach from `text`, pointing at the number whose raw text is `amount`. */
const teach = (text: string, amount: string, type: "expense" | "income", toman = false) => {
  const tok = numberTokens(normalizeText(text)).find((t) => t.raw === amount)!;
  return learnRule(text, tok, type, toman)!;
};

// A bank that writes bare numbers with no comma, unit or «مبلغ» — the generic parser can't read it.
const kasr = "بانک نمونه\nکسر 1250000 از حساب 1234***56\nمانده 45000000\n1405/07/20 12:30";
const variz = "بانک نمونه\nافزایش 800000 به حساب 1234***56\nمانده 45800000\n1405/07/21 09:10";

describe("learned SMS rules", () => {
  it("the generic parser misses these, the learned rule reads the next SMS of the same shape", () => {
    expect(parse(kasr)).toBeNull();
    const rule = teach(kasr, "1250000", "expense");
    expect(rule).toMatchObject({ before: "کسر", after: "از", keyword: "کسر", type: "expense" });
    expect(applyRules("بانک نمونه\nکسر 330000 از حساب 1234***56\nمانده 9000000\n1405/08/02 18:00", [rule])).toEqual({
      amount: 330000,
      type: "expense",
      typeUncertain: false,
    });
  });

  it("keeps expense and income rules apart by their keyword", () => {
    const rules = [teach(kasr, "1250000", "expense"), teach(variz, "800000", "income")];
    expect(applyRules(variz.replace("800000", "1500000"), rules)).toMatchObject({ amount: 1500000, type: "income" });
    expect(applyRules(kasr.replace("1250000", "70000"), rules)).toMatchObject({ amount: 70000, type: "expense" });
  });

  it("uses the line above when the amount starts its line, and the sign when the sample had one", () => {
    const sample = "حساب 99*\nمبلغ تراکنش\n120000-\nمانده 5000";
    const rule = teach(sample, "120000", "expense");
    expect(rule.before).toBe("مبلغ تراکنش");
    expect(applyRules("حساب 99*\nمبلغ تراکنش\n640000+\nمانده 5000", [rule])).toMatchObject({ amount: 640000, type: "income" });
  });

  it("applies the unit: Toman rules ×10, an explicit unit in the SMS wins", () => {
    const rule = teach("پرداخت 50000 بابت قبض", "50000", "expense", true);
    expect(applyRules("پرداخت 70000 بابت قبض", [rule])?.amount).toBe(700000);
    expect(applyRules("پرداخت 70000 ریال بابت قبض", [{ ...rule, after: "ریال" }])?.amount).toBe(70000);
  });

  it("refuses a number with no words around it", () => {
    const text = "123456";
    expect(learnRule(text, numberTokens(text)[0], "expense", false)).toBeNull();
  });
});

describe("unread SMS", () => {
  const bank: Bank = { id: "b", name: "نمونه", sender: "+98200" };

  it("keeps unreadable SMS from known banks (not OTPs), then reads them once a rule exists", () => {
    const caps = [
      { id: "1", sender: "+98200", text: kasr, ts: 1 },
      { id: "2", sender: "+98200", text: "رمز پویا: 55123", ts: 2 },
      { id: "3", sender: "+98999", text: kasr, ts: 3 },
    ];
    const { added, unread } = readCaptures(caps, [bank], []);
    expect(added).toHaveLength(0);
    expect(unread.map((u) => u.id)).toEqual(["1"]);

    const taught = { ...bank, rules: [teach(kasr, "1250000", "expense")] };
    const again = rereadUnread(unread, [taught], []);
    expect(again.readIds).toEqual(["1"]);
    expect(again.added[0]).toMatchObject({ amount: 1250000, type: "expense", bankId: "b", source: "sms" });
  });
});
