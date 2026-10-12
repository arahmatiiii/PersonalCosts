import type { SmsRule, TxType } from "../types";
import { newId } from "./id";
import { EXPENSE, INCOME, normalizeText, type ParseResult } from "./parser";

/**
 * Per-bank SMS rules learned from one sample: the user points at the amount in a real SMS and says
 * whether it was an expense or an income. We keep only the words right around the amount (and the
 * word that tells the type), never the dates, card digits or balance, so the rule keeps matching when
 * those change.
 */

export interface NumberToken {
  start: number;
  end: number;
  raw: string;
  value: number;
}

/** Every number in the (normalized) text, with its position. */
export function numberTokens(norm: string): NumberToken[] {
  const out: NumberToken[] = [];
  const re = /\d{1,3}(?:,\d{3})+|\d+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(norm))) out.push({ start: m.index, end: m.index + m[0].length, raw: m[0], value: Number(m[0].replace(/,/g, "")) });
  return out;
}

const words = (s: string) =>
  s
    .replace(/[\d,.:：/*+\-()[\]«»"'٫]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

/** Up to two words before the number (this line, or the previous one if this line has none) and one after. */
export function contextOf(norm: string, start: number, end: number): { before: string; after: string } {
  const lineStart = norm.lastIndexOf("\n", start - 1) + 1;
  let pre = words(norm.slice(lineStart, start));
  if (pre.length === 0 && lineStart > 0) pre = words(norm.slice(norm.lastIndexOf("\n", lineStart - 2) + 1, lineStart - 1));
  const lineEnd = norm.indexOf("\n", end);
  const rest = norm.slice(end, lineEnd === -1 ? undefined : lineEnd);
  const post = words(rest.split(/\d/)[0]);
  return { before: pre.slice(-2).join(" "), after: post.slice(0, 1).join(" ") };
}

function signAround(norm: string, t: NumberToken): "+" | "-" | null {
  const lead = /([+-])\s*$/.exec(norm.slice(Math.max(0, t.start - 3), t.start));
  if (lead && !/\d\s*[+-]\s*$/.test(norm.slice(Math.max(0, t.start - 4), t.start))) return lead[1] as "+" | "-";
  const trail = /^\s*([+-])/.exec(norm.slice(t.end, t.end + 3));
  if (trail && !/^\s*[+-]\s*\d/.test(norm.slice(t.end, t.end + 4))) return trail[1] as "+" | "-";
  return null;
}

/** Learn a rule from `text` where the number at `token` is the amount and the SMS was a `type`. */
export function learnRule(text: string, token: NumberToken, type: TxType, toman: boolean): SmsRule | null {
  const norm = normalizeText(text);
  const { before, after } = contextOf(norm, token.start, token.end);
  if (!before && !after) return null;
  const keyword = (type === "income" ? INCOME : EXPENSE).find((k) => norm.includes(k)) ?? null;
  return { id: newId(), before, after, type, keyword, sign: signAround(norm, token) !== null, toman, sample: text.trim().slice(0, 300) };
}

/** The first number in `text` whose surroundings match `rule`. */
export function applyRule(text: string, rule: SmsRule): ParseResult | null {
  const norm = normalizeText(text);
  if (rule.keyword && !norm.includes(rule.keyword)) return null;
  for (const t of numberTokens(norm)) {
    if (!t.value) continue;
    const c = contextOf(norm, t.start, t.end);
    if (rule.before && !c.before.endsWith(rule.before)) continue;
    if (rule.after && !c.after.startsWith(rule.after)) continue;
    const unit = /^\s*(ریال|تومان)/.exec(norm.slice(t.end, t.end + 10))?.[1];
    const amount = (unit ? unit === "تومان" : rule.toman) ? t.value * 10 : t.value;
    const sign = rule.sign ? signAround(norm, t) : null;
    return { amount, type: sign ? (sign === "+" ? "income" : "expense") : rule.type, typeUncertain: false };
  }
  return null;
}

export function applyRules(text: string, rules: SmsRule[] | undefined): ParseResult | null {
  for (const r of rules ?? []) {
    const res = applyRule(text, r);
    if (res) return res;
  }
  return null;
}
