import { create } from "zustand";
import { persist } from "zustand/middleware";
import defaultBanks from "../seed/banks.json";
import defaultTags from "../seed/tags.json";
import { newId } from "../lib/id";
import { DEFAULT_SETTINGS, type Bank, type DebugEntry, type Tag, type Transaction, type UserSettings } from "../types";

export type TabId = "home" | "stats" | "settings";

const MAX_DEBUG = 200;

export interface AppState {
  activeTab: TabId;
  transactions: Transaction[];
  banks: Bank[];
  tags: Tag[];
  settings: UserSettings;
  debugLog: DebugEntry[];
  captureAll: boolean;

  setActiveTab: (t: TabId) => void;

  addTransactions: (txs: Transaction[]) => void;
  updateTransaction: (id: string, patch: Partial<Omit<Transaction, "id">>) => void;
  deleteTransaction: (id: string) => void;

  addBank: (b: Omit<Bank, "id">) => void;
  updateBank: (id: string, patch: Partial<Omit<Bank, "id">>) => void;
  deleteBank: (id: string) => void;

  addTag: (label: string, color: string) => void;
  updateTag: (id: string, patch: Partial<Omit<Tag, "id">>) => void;
  deleteTag: (id: string) => void;
  moveTag: (id: string, dir: -1 | 1) => void;

  saveSettings: (patch: Partial<UserSettings>) => void;

  appendDebug: (entries: DebugEntry[]) => void;
  clearDebug: () => void;
  setCaptureAll: (on: boolean) => void;

  importBackup: (data: BackupData) => void;
}

export interface BackupData {
  version: 1;
  transactions: Transaction[];
  banks: Bank[];
  tags: Tag[];
  settings: UserSettings;
}

const seedBanks = (): Bank[] => defaultBanks.map((b) => ({ ...b, id: newId() }));
const seedTags = (): Tag[] => defaultTags.map((t, i) => ({ ...t, id: newId(), order: i }));

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      activeTab: "home",
      transactions: [],
      banks: seedBanks(),
      tags: seedTags(),
      settings: DEFAULT_SETTINGS,
      debugLog: [],
      captureAll: false,

      setActiveTab: (activeTab) => set({ activeTab }),

      addTransactions: (txs) => txs.length && set((s) => ({ transactions: [...txs, ...s.transactions] })),
      updateTransaction: (id, patch) =>
        set((s) => ({ transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      deleteTransaction: (id) => set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) })),

      addBank: (b) => set((s) => ({ banks: [...s.banks, { ...b, id: newId() }] })),
      updateBank: (id, patch) => set((s) => ({ banks: s.banks.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),
      deleteBank: (id) => set((s) => ({ banks: s.banks.filter((b) => b.id !== id) })),

      addTag: (label, color) =>
        set((s) => ({
          tags: [...s.tags, { id: newId(), label, color, order: s.tags.length ? Math.max(...s.tags.map((t) => t.order)) + 1 : 0 }],
        })),
      updateTag: (id, patch) => set((s) => ({ tags: s.tags.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      deleteTag: (id) => set((s) => ({ tags: s.tags.filter((t) => t.id !== id) })),
      moveTag: (id, dir) =>
        set((s) => {
          const sorted = [...s.tags].sort((a, b) => a.order - b.order);
          const i = sorted.findIndex((t) => t.id === id);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= sorted.length) return {};
          [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
          return { tags: sorted.map((t, order) => ({ ...t, order })) };
        }),

      saveSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      appendDebug: (entries) => entries.length && set((s) => ({ debugLog: [...entries.reverse(), ...s.debugLog].slice(0, MAX_DEBUG) })),
      clearDebug: () => set({ debugLog: [] }),
      setCaptureAll: (captureAll) => set({ captureAll }),

      importBackup: (d) => set({ transactions: d.transactions, banks: d.banks, tags: d.tags, settings: { ...DEFAULT_SETTINGS, ...d.settings } }),
    }),
    {
      name: "personalcost-store",
      version: 1,
      partialize: (s) => ({
        activeTab: s.activeTab,
        transactions: s.transactions,
        banks: s.banks,
        tags: s.tags,
        settings: s.settings,
        debugLog: s.debugLog,
        captureAll: s.captureAll,
      }),
    },
  ),
);

export function makeBackup(s: AppState): BackupData {
  return { version: 1, transactions: s.transactions, banks: s.banks, tags: s.tags, settings: s.settings };
}
