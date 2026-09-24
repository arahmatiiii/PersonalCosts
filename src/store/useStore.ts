import { create } from "zustand";
import { persist } from "zustand/middleware";
import { autoFund } from "../lib/funds";
import { newId } from "../lib/id";
import { DEFAULT_SETTINGS, TAG_COLORS, type Bank, type Tag, type Transaction, type UserSettings } from "../types";

export type TabId = "home" | "history" | "stats" | "settings";

export interface AppState {
  activeTab: TabId;
  transactions: Transaction[];
  banks: Bank[];
  tags: Tag[];
  settings: UserSettings;

  setActiveTab: (t: TabId) => void;

  addTransactions: (txs: Transaction[]) => void;
  updateTransaction: (id: string, patch: Partial<Omit<Transaction, "id">>) => void;
  /** Tag a transaction; an expense whose tag matches a «پول» that month is paid from it. */
  tagTransaction: (id: string, tag: string) => void;
  deleteTransaction: (id: string) => void;

  addBank: (name: string, sender: string) => void;
  deleteBank: (id: string) => void;

  addTag: (label: string) => void;
  deleteTag: (id: string) => void;

  saveSettings: (patch: Partial<UserSettings>) => void;
  importBackup: (data: BackupData) => void;
}

export interface BackupData {
  version: 2;
  transactions: Transaction[];
  banks: Bank[];
  tags: Tag[];
  settings: UserSettings;
}

const defaultTags = (): Tag[] => [
  { id: newId(), label: "اسنپ", color: TAG_COLORS[0] },
  { id: newId(), label: "شارژ", color: TAG_COLORS[1] },
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
    s.tags = untouched ? defaultTags() : oldTags.map(({ id, label, color }) => ({ id, label, color }));
    s.transactions = ((s.transactions as Transaction[] | undefined) ?? []).map((t) =>
      (t.source as string) === "notification" ? { ...t, source: "sms" } : t,
    );
    delete s.debugLog;
    delete s.captureAll;
  }
  return s;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      activeTab: "home",
      transactions: [],
      banks: [],
      tags: defaultTags(),
      settings: DEFAULT_SETTINGS,

      setActiveTab: (activeTab) => set({ activeTab }),

      addTransactions: (txs) => {
        if (txs.length) set((s) => ({ transactions: [...txs, ...s.transactions] }));
      },
      updateTransaction: (id, patch) =>
        set((s) => ({ transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      tagTransaction: (id, tag) =>
        set((s) => ({
          transactions: s.transactions.map((t) =>
            t.id === id ? { ...t, tag, tagged: true, typeUncertain: false, ...autoFund(t, tag, s.transactions) } : t,
          ),
        })),
      deleteTransaction: (id) => set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) })),

      addBank: (name, sender) => set((s) => ({ banks: [...s.banks, { id: newId(), name, sender }] })),
      deleteBank: (id) => set((s) => ({ banks: s.banks.filter((b) => b.id !== id) })),

      addTag: (label) => set((s) => ({ tags: [...s.tags, { id: newId(), label, color: nextColor(s.tags) }] })),
      deleteTag: (id) => set((s) => ({ tags: s.tags.filter((t) => t.id !== id) })),

      saveSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      importBackup: (d) => set({ transactions: d.transactions, banks: d.banks, tags: d.tags, settings: { ...DEFAULT_SETTINGS, ...d.settings } }),
    }),
    {
      name: "personalcost-store",
      version: 2,
      migrate: (p, v) => migrate(p, v) as AppState,
      merge: (persisted, current) => ({ ...current, ...(persisted as Partial<AppState>), activeTab: "home" }),
      // activeTab is not persisted: the app always opens on Home.
      partialize: (s) => ({
        transactions: s.transactions,
        banks: s.banks,
        tags: s.tags,
        settings: s.settings,
      }),
    },
  ),
);

export function makeBackup(s: AppState): BackupData {
  return { version: 2, transactions: s.transactions, banks: s.banks, tags: s.tags, settings: s.settings };
}
