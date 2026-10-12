import { create } from "zustand";
import { persist } from "zustand/middleware";
import { newId } from "../lib/id";
import { DEFAULT_SETTINGS, TAG_COLORS, type Bank, type SmsRule, type Tag, type TagKind, type Transaction, type UnreadSms, type UserSettings } from "../types";

export type TabId = "home" | "history" | "stats" | "settings";

export interface Toast {
  id: number;
  text: string;
  undo?: () => void;
}

export interface AppState {
  activeTab: TabId;
  transactions: Transaction[];
  banks: Bank[];
  tags: Tag[];
  settings: UserSettings;
  /** SMS from known banks that couldn't be read yet (newest first). */
  unread: UnreadSms[];
  toast: Toast | null;

  setActiveTab: (t: TabId) => void;

  addTransactions: (txs: Transaction[]) => void;
  updateTransaction: (id: string, patch: Partial<Omit<Transaction, "id">>) => void;
  /** Tag a transaction; an expense can also say which «پول» paid for it. */
  tagTransaction: (id: string, tag: string, fund?: Pick<Transaction, "fund" | "fundMonth">) => void;
  deleteTransaction: (id: string) => void;

  addBank: (name: string, sender: string) => void;
  deleteBank: (id: string) => void;
  addBankRule: (bankId: string, rule: SmsRule) => void;
  deleteBankRule: (bankId: string, ruleId: string) => void;

  addUnread: (items: UnreadSms[]) => void;
  removeUnread: (ids: string[]) => void;

  addTag: (label: string, kind: TagKind) => void;
  deleteTag: (id: string) => void;

  saveSettings: (patch: Partial<UserSettings>) => void;
  importBackup: (data: BackupData) => void;
  showToast: (text: string, undo?: () => void) => void;
  hideToast: () => void;
}

export interface BackupData {
  version: 2 | 3;
  transactions: Transaction[];
  banks: Bank[];
  tags: Tag[];
  settings: UserSettings;
}

const defaultTags = (): Tag[] => [
  { id: newId(), label: "اسنپ", color: TAG_COLORS[0], kind: "expense" },
  { id: newId(), label: "شارژ", color: TAG_COLORS[1], kind: "expense" },
  { id: newId(), label: "حقوق", color: TAG_COLORS[2], kind: "fund" },
];

function nextColor(tags: Tag[]): string {
  const used = new Set(tags.map((t) => t.color));
  return TAG_COLORS.find((c) => !used.has(c)) ?? TAG_COLORS[tags.length % TAG_COLORS.length];
}

/** v1 → v2: banks become name + sender (placeholders dropped); the old 8 preset tags are replaced. */
export function migrate(persisted: unknown, version: number): unknown {
  const s = (persisted ?? {}) as Record<string, unknown>;
  if (version < 2) {
    type OldBank = { id: string; name: string; matchSenderIds?: string[] };
    s.banks = ((s.banks as OldBank[] | undefined) ?? []).flatMap((b) =>
      (b.matchSenderIds ?? []).filter((x) => x && !x.startsWith("VERIFY_ME")).slice(0, 1).map((sender) => ({ id: b.id, name: b.name, sender })),
    );
    const oldTags = (s.tags as { id: string; label: string; color: string }[] | undefined) ?? [];
    const oldPreset = ["خوراک", "رفت‌وآمد", "خرید خانه", "قبوض", "تفریح", "سلامت", "حقوق", "سایر"];
    const untouched = oldTags.length === oldPreset.length && oldTags.every((t) => oldPreset.includes(t.label));
    s.tags = untouched ? defaultTags().filter((t) => t.kind === "expense") : oldTags.map(({ id, label, color }) => ({ id, label, color }));
    s.transactions = ((s.transactions as Transaction[] | undefined) ?? []).map((t) =>
      (t.source as string) === "notification" ? { ...t, source: "sms" } : t,
    );
    delete s.debugLog;
    delete s.captureAll;
  }
  if (version < 3) s.tags = splitTagKinds((s.tags as Tag[] | undefined) ?? [], (s.transactions as Transaction[] | undefined) ?? []);
  return s;
}

/**
 * v2 → v3: tags get a kind. A tag used on incomes becomes a «پول» tag, otherwise an expense tag; a
 * tag used on both is kept as one of each.
 */
export function splitTagKinds(tags: Omit<Tag, "kind">[], transactions: Transaction[]): Tag[] {
  const onIncome = new Set(transactions.filter((t) => t.type === "income" && t.tag).map((t) => t.tag));
  const onExpense = new Set(transactions.filter((t) => t.type === "expense" && t.tag).map((t) => t.tag));
  return tags.flatMap((t): Tag[] => {
    const base = { id: t.id, label: t.label, color: t.color };
    if (!onIncome.has(t.label)) return [{ ...base, kind: "expense" }];
    if (!onExpense.has(t.label)) return [{ ...base, kind: "fund" }];
    return [
      { ...base, kind: "expense" },
      { ...base, id: `${t.id}-fund`, kind: "fund" },
    ];
  });
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      activeTab: "home",
      transactions: [],
      banks: [],
      tags: defaultTags(),
      settings: DEFAULT_SETTINGS,
      unread: [],
      toast: null,

      setActiveTab: (activeTab) => set({ activeTab }),

      addTransactions: (txs) => {
        if (txs.length) set((s) => ({ transactions: [...txs, ...s.transactions] }));
      },
      updateTransaction: (id, patch) =>
        set((s) => ({ transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      tagTransaction: (id, tag, fund) =>
        set((s) => ({
          transactions: s.transactions.map((t) => (t.id === id ? { ...t, tag, tagged: true, typeUncertain: false, ...fund } : t)),
        })),
      deleteTransaction: (id) => set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) })),

      addBank: (name, sender) => set((s) => ({ banks: [...s.banks, { id: newId(), name, sender }] })),
      deleteBank: (id) => set((s) => ({ banks: s.banks.filter((b) => b.id !== id), unread: s.unread.filter((u) => u.bankId !== id) })),
      addBankRule: (bankId, rule) => set((s) => ({ banks: s.banks.map((b) => (b.id === bankId ? { ...b, rules: [rule, ...(b.rules ?? [])] } : b)) })),
      deleteBankRule: (bankId, ruleId) =>
        set((s) => ({ banks: s.banks.map((b) => (b.id === bankId ? { ...b, rules: (b.rules ?? []).filter((r) => r.id !== ruleId) } : b)) })),

      addUnread: (items) =>
        set((s) => {
          const known = new Set(s.unread.map((u) => u.id));
          const fresh = items.filter((u) => !known.has(u.id));
          return fresh.length ? { unread: [...fresh.reverse(), ...s.unread].slice(0, 100) } : {};
        }),
      removeUnread: (ids) => set((s) => ({ unread: s.unread.filter((u) => !ids.includes(u.id)) })),

      addTag: (label, kind) => set((s) => ({ tags: [...s.tags, { id: newId(), label, color: nextColor(s.tags), kind }] })),
      deleteTag: (id) => set((s) => ({ tags: s.tags.filter((t) => t.id !== id) })),

      saveSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      importBackup: (d) =>
        set({
          transactions: d.transactions,
          banks: d.banks,
          tags: d.version === 3 ? d.tags : splitTagKinds(d.tags, d.transactions),
          settings: { ...DEFAULT_SETTINGS, ...d.settings },
        }),
      showToast: (text, undo) => set({ toast: { id: Date.now(), text, undo } }),
      hideToast: () => set({ toast: null }),
    }),
    {
      name: "personalcost-store",
      version: 3,
      migrate: (p, v) => migrate(p, v) as AppState,
      merge: (persisted, current) => {
        const p = persisted as Partial<AppState>;
        return { ...current, ...p, settings: { ...DEFAULT_SETTINGS, ...p.settings }, activeTab: "home" };
      },
      // activeTab is not persisted: the app always opens on Home.
      partialize: (s) => ({
        transactions: s.transactions,
        banks: s.banks,
        tags: s.tags,
        settings: s.settings,
        unread: s.unread,
      }),
    },
  ),
);

export function makeBackup(s: AppState): BackupData {
  return { version: 3, transactions: s.transactions, banks: s.banks, tags: s.tags, settings: s.settings };
}
