import { describe, expect, it } from "vitest";
import type { Bank } from "../types";
import { ingestCaptures, readCaptures, type Capture } from "./ingest";
import { migrate } from "../store/useStore";

const bank: Bank = { id: "melli", name: "ملی", sender: "+989991234567" };
const cap = (over: Partial<Capture>): Capture => ({ id: "1", sender: "09991234567", text: "خرید 120,000 ريال", ts: 1_000_000, ...over });

describe("ingestCaptures", () => {
  it("turns an SMS from a known sender into an untagged transaction", () => {
    const [tx] = ingestCaptures([cap({})], [bank], []);
    expect(tx).toMatchObject({ amount: 120000, type: "expense", bankId: "melli", source: "sms", tagged: false });
  });

  it("drops unknown senders and messages without an amount", () => {
    expect(ingestCaptures([cap({ sender: "+98912000" })], [bank], [])).toHaveLength(0);
    expect(ingestCaptures([cap({ text: "رمز پویا: 55123" })], [bank], [])).toHaveLength(0);
  });

  it("dedups the same SMS queued twice but keeps separate purchases", () => {
    expect(ingestCaptures([cap({}), cap({ id: "2", ts: 1_010_000 })], [bank], [])).toHaveLength(1);
    expect(ingestCaptures([cap({}), cap({ id: "2", ts: 1_000_000 + 10 * 60_000 })], [bank], [])).toHaveLength(2);
    const existing = ingestCaptures([cap({})], [bank], []);
    expect(ingestCaptures([cap({ ts: 1_020_000 })], [bank], existing)).toHaveLength(0);
  });
});

describe("two SMS for one expense", () => {
  const hold = "مسدودی مبلغ 120,000 ريال\nکارت 1234\n0825-10:12";
  const deduct = "کسر از حساب\nمبلغ: 120,000 ریال\nمانده: 5,000,000\n0826-09:00";
  const DAY = 86_400_000;

  it("folds the second message (next day, different format) into the first", () => {
    const r = readCaptures([cap({ id: "a", text: hold }), cap({ id: "b", text: deduct, ts: 1_000_000 + DAY })], [bank], []);
    expect(r.added).toHaveLength(1);
    expect(r.added[0]).toMatchObject({ amount: 120000, captureId: "a", mergedCaptureId: "b", mergedText: deduct });
  });

  it("merges into an already recorded transaction", () => {
    const first = readCaptures([cap({ id: "a", text: hold })], [bank], []).added;
    const r = readCaptures([cap({ id: "b", text: deduct, ts: 1_000_000 + DAY })], [bank], first);
    expect(r.added).toHaveLength(0);
    expect(r.merges).toEqual([expect.objectContaining({ txId: first[0].id, captureId: "b" })]);
  });

  it("keeps two purchases of the same price (same SMS format) and pairs beyond two days", () => {
    const again = deduct.replace("5,000,000", "4,880,000").replace("0826-09:00", "0826-18:30");
    expect(readCaptures([cap({ id: "a", text: deduct }), cap({ id: "b", text: again, ts: 1_000_000 + 9 * 3_600_000 })], [bank], []).added).toHaveLength(2);
    expect(readCaptures([cap({ id: "a", text: hold }), cap({ id: "b", text: deduct, ts: 1_000_000 + 3 * DAY })], [bank], []).added).toHaveLength(2);
  });

  it("pairs each second message once: hold, deduct, hold, deduct = two expenses", () => {
    const caps = [hold, deduct, hold, deduct].map((text, i) => cap({ id: String(i), text, ts: 1_000_000 + i * 3 * 3_600_000 }));
    expect(readCaptures(caps, [bank], []).added).toHaveLength(2);
  });
});

describe("migrate v1 → v2", () => {
  it("keeps real senders, drops placeholders, replaces untouched preset tags", () => {
    const out = migrate(
      {
        banks: [
          { id: "a", name: "ملی", matchSenderIds: ["VERIFY_ME_X"] },
          { id: "b", name: "بلو", matchSenderIds: ["+98999"] },
        ],
        tags: ["خوراک", "رفت‌وآمد", "خرید خانه", "قبوض", "تفریح", "سلامت", "حقوق", "سایر"].map((label, i) => ({ id: String(i), label, color: "#000", order: i })),
        transactions: [],
        debugLog: [],
      },
      1,
    ) as { banks: Bank[]; tags: { label: string }[]; debugLog?: unknown };
    expect(out.banks).toEqual([{ id: "b", name: "بلو", sender: "+98999" }]);
    expect(out.tags.map((t) => t.label)).toEqual(["اسنپ", "شارژ"]);
    expect(out.debugLog).toBeUndefined();
  });
});
