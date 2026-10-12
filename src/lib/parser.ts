import type { TxType } from "../types";

/**
 * Generic parser for Iranian bank SMS. Banks are identified only by sender number, so amount and
 * direction are extracted with rules that work across banks (Melli, Mellat, Saderat, Blu, …):
 *
 *   amount — a number next to «مبلغ», or followed by «ریال/تومان», or carrying a +/- sign;
 *            balance figures («مانده/موجودی») and dates/times/card numbers are ignored.
 *   type   — the sign wins (+ income, − expense), then keywords; otherwise flagged as uncertain.
 *
 * Amounts are returned in Rial (Toman amounts are ×10).
 */

/** Persian/Arabic digits → ASCII, Persian separators → ",", Arabic yeh/kaf → Persian, ZWNJ → space. */
export function normalizeText(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[٬،]/g, ",")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/‌/g, " ")
    .replace(/[‎‏‪-‮]/g, ""); // bidi marks some banks insert around numbers
}

export interface ParseResult {
  amount: number; // Rial
  type: TxType;
  typeUncertain: boolean;
}

export const INCOME = ["واریز", "افزایش", "دریافت", "سود", "برگشت", "بستانکار", "انتقال به حساب شما"];
export const EXPENSE = ["برداشت", "خرید", "کسر", "پرداخت", "کارمزد", "بدهکار", "انتقال از", "قسط", "شارژ"];
const BALANCE = /(مانده|موجودی|مانده حساب|قابل برداشت)\s*[:：]?\s*[+-]?\s*[\d,]+/g;

interface Candidate {
  value: number;
  score: number;
  sign: "+" | "-" | null;
  toman: boolean;
}

export function parse(text: string): ParseResult | null {
  const norm = normalizeText(text);
  if (/رمز|کد تایید|کد فعال/.test(norm) && !/مبلغ/.test(norm)) return null; // OTP / verification SMS
  const cleaned = norm.replace(BALANCE, " ");

  const candidates: Candidate[] = [];
  const re = /([+-])?\s*(\d{1,3}(?:,\d{3})+|\d+)\s*([+-])?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned))) {
    const raw = m[2];
    const digits = raw.replace(/,/g, "");
    const start = m.index + m[0].indexOf(raw);
    const end = start + raw.length;
    const before = cleaned.slice(Math.max(0, start - 14), start);
    const after = cleaned.slice(end, end + 10);

    // Not amounts: dates (1405/07/01), times (12:30), masked/long card & account numbers.
    if (/\d\s*[/:*-]$/.test(before) || /^[/:*]\s*\d/.test(after) || /^\*/.test(after)) continue;
    if (!raw.includes(",") && digits.length > 12) continue;
    const value = Number(digits);
    if (!value) continue;

    let score = 0;
    if (raw.includes(",")) score += 2;
    if (/مبلغ\s*[:：]?\s*$/.test(before)) score += 5;
    const toman = /^\s*تومان/.test(after);
    if (/^\s*(ریال|تومان)/.test(after)) score += 4;
    // A sign glued to another number is a separator (e.g. "0701-12:30"), not a direction.
    const lead = m[1] && !/\d\s*$/.test(cleaned.slice(0, m.index)) ? m[1] : null;
    const trail = m[3] && !/^\s*\d/.test(cleaned.slice(m.index + m[0].length)) ? m[3] : null;
    const sign = (lead ?? trail) as Candidate["sign"];
    if (sign) score += 3;
    if (score < 2) continue; // a bare number with no comma/unit/sign/«مبلغ» (codes, ids, OTPs)
    if (!raw.includes(",") && digits.length < 4 && score < 4) continue; // stray small numbers
    candidates.push({ value, score, sign, toman });
  }
  if (candidates.length === 0) return null;

  const best = candidates.reduce((a, b) => (b.score > a.score ? b : a));
  const amount = best.toman ? best.value * 10 : best.value;

  if (best.sign === "+") return { amount, type: "income", typeUncertain: false };
  if (best.sign === "-") return { amount, type: "expense", typeUncertain: false };
  const has = (kws: string[]) => kws.some((k) => cleaned.includes(k));
  const inc = has(INCOME);
  const exp = has(EXPENSE);
  if (exp && !inc) return { amount, type: "expense", typeUncertain: false };
  if (inc && !exp) return { amount, type: "income", typeUncertain: false };
  return { amount, type: "expense", typeUncertain: true };
}

/**
 * Normalizes SMS sender ids so "+98 999 1234", "00989991234", "09991234" and "989991234"
 * compare equal. Mirrored in android/.../CaptureStore.java — keep in sync.
 */
export function normalizeSender(raw: string): string {
  let s = normalizeText(raw).toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  if (/^\d+$/.test(s)) {
    if (s.startsWith("0098")) s = s.slice(4);
    else if (s.startsWith("98") && s.length > 10) s = s.slice(2);
    else if (s.startsWith("0")) s = s.slice(1);
  }
  return s;
}
