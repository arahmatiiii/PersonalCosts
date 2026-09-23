/**
 * JS mirror of android/.../parsing/ParserEngine.kt, used by the Settings page to let
 * you test a bank's regex/keywords against a sample SMS before saving it.
 * Keep the two implementations in sync.
 */
import type { Bank, TxType } from "../types";

/** Persian/Arabic digits → ASCII, Arabic yeh/kaf → Persian, Persian/Arabic thousands separators → ",". */
export function normalizeText(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[٬،]/g, ",")
    .replace(/ي/g, "ی")
    .replace(/ى/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/‌/g, " "); // ZWNJ → space so "افزایش‌موجودی" matches "افزایش موجودی"
}

export interface ParseResult {
  amount: number;
  type: TxType;
  typeUncertain: boolean;
}

export type ParseOutcome = { ok: true; result: ParseResult } | { ok: false; error: string };

export function parse(bank: Pick<Bank, "regexAmount" | "incomeKeywords" | "expenseKeywords">, text: string): ParseOutcome {
  let re: RegExp;
  try {
    re = new RegExp(normalizeText(bank.regexAmount));
  } catch (e) {
    return { ok: false, error: `regex نامعتبر است: ${(e as Error).message}` };
  }
  const norm = normalizeText(text);
  const m = re.exec(norm);
  if (!m) return { ok: false, error: "regex مبلغ با متن مطابقت نداشت" };
  if (m[1] === undefined) return { ok: false, error: "regex باید دقیقاً یک گروه capture برای مبلغ داشته باشد" };
  const digits = m[1].replace(/[^\d]/g, "");
  if (!digits) return { ok: false, error: "گروه capture عددی نداشت" };
  const amount = Number(digits);

  const has = (kws: string[]) => kws.some((k) => k.trim() && norm.includes(normalizeText(k.trim())));
  if (has(bank.expenseKeywords)) return { ok: true, result: { amount, type: "expense", typeUncertain: false } };
  if (has(bank.incomeKeywords)) return { ok: true, result: { amount, type: "income", typeUncertain: false } };
  return { ok: true, result: { amount, type: "expense", typeUncertain: true } };
}
