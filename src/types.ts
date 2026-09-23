export type TxType = "expense" | "income";
export type TxSource = "sms" | "notification" | "manual";

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
  /** Parser found no income/expense keyword and defaulted to "expense" — needs review. */
  typeUncertain: boolean;
  createdAt: number;
}

export interface Bank {
  id: string;
  name: string;
  matchPackages: string[];
  matchSenderIds: string[];
  regexAmount: string;
  incomeKeywords: string[];
  expenseKeywords: string[];
  enabled: boolean;
  isDefault: boolean;
}

export interface Tag {
  id: string;
  label: string;
  color: string;
  order: number;
}

export interface UserSettings {
  reminderHour: number;
  reminderMinute: number;
  reminderEnabled: boolean;
}

export interface DebugEntry {
  t: number;
  status: string;
  origin: string;
  text: string;
}

export const DEFAULT_SETTINGS: UserSettings = {
  reminderHour: 22,
  reminderMinute: 0,
  reminderEnabled: true,
};

export const CASH_BANK_ID = "cash";
