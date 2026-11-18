export type TxType = "expense" | "income";
export type TxSource = "sms" | "manual";

/**
 * Amounts are ALWAYS stored in Rial (what Iranian banks quote).
 * The UI converts to Toman (÷10) for display only — see lib/format.ts.
 */
export interface Transaction {
  id: string;
  amount: number;
  type: TxType;
  bankId: string; // bank id, or "cash" for manual cash entries
  timestamp: number; // epoch ms
  rawText: string;
  source: TxSource;
  tag: string | null;
  note: string | null;
  tagged: boolean;
  /** Parser couldn't tell income from expense and defaulted to "expense" — needs review. */
  typeUncertain: boolean;
  /** Expenses only: which «پول» (tag of an income) paid for this. */
  fund?: string | null;
  /** SMS only: id of the native capture it came from (links the «tag from notification» choice). */
  captureId?: string;
  /** A second SMS for the same expense (e.g. a «مسدودی» then the «کسر»), folded into this one. */
  mergedText?: string;
  mergedCaptureId?: string;
  createdAt: number;
}

/** Money moved from one «پول» to another (not an income or expense). Amount in Rial. */
export interface FundTransfer {
  id: string;
  from: string;
  to: string;
  amount: number;
  timestamp: number;
  note: string | null;
}

/** A bank is just a name and the SMS sender number its messages come from. */
export interface Bank {
  id: string;
  name: string;
  sender: string;
  /** Rules learned from sample SMS; tried before the generic parser. */
  rules?: SmsRule[];
}

/** "The amount is the number between `before` and `after`" — learned from one sample SMS (lib/smsRules.ts). */
export interface SmsRule {
  id: string;
  before: string;
  after: string;
  type: TxType;
  /** A word from the sample that must be present (e.g. «برداشت»), so expense and income rules don't clash. */
  keyword: string | null;
  /** The sample's amount carried a +/− sign: the sign decides the type. */
  sign: boolean;
  /** Amount is in Toman when the SMS doesn't say. */
  toman: boolean;
  sample: string;
}

/** An SMS from a known bank that couldn't be read; kept so the user can teach a rule from it. */
export interface UnreadSms {
  id: string;
  bankId: string;
  text: string;
  ts: number;
}

/** "expense" tags describe what an expense was; "fund" tags name a «پول» (an income pot). */
export type TagKind = "expense" | "fund";

export interface Tag {
  id: string;
  label: string;
  color: string;
  kind: TagKind;
}

export interface UserSettings {
  reminderHour: number;
  reminderMinute: number;
  reminderEnabled: boolean;
  /** Local midnight of the last salary payday; Home and Stats start from it. null: calendar month. */
  salaryDate: number | null;
  /** Android: a heads-up notification with tag buttons as soon as a bank SMS arrives. */
  tagNotify: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  reminderHour: 22,
  reminderMinute: 0,
  reminderEnabled: true,
  salaryDate: null,
  tagNotify: true,
};

export const CASH_BANK_ID = "cash";

export const TAG_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ec4899", "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6", "#f97316", "#64748b"];
