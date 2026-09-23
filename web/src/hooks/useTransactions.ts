import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useMemo } from "react";
import { db } from "../firebase";
import type { Transaction, TxType } from "../types";
import { useLiveQuery } from "./useCollection";

const col = collection(db, "transactions");

/** Live transactions with from <= timestamp <= to, newest first. */
export function useTransactions(from: Date, to: Date) {
  const fromMs = from.getTime();
  const toMs = to.getTime();
  const q = useMemo(
    () =>
      query(
        col,
        where("timestamp", ">=", Timestamp.fromMillis(fromMs)),
        where("timestamp", "<=", Timestamp.fromMillis(toMs)),
        orderBy("timestamp", "desc"),
      ),
    [fromMs, toMs],
  );
  return useLiveQuery<Transaction>(q, `tx:${fromMs}:${toMs}`);
}

/** All untagged transactions regardless of date, so nothing older slips through review. */
export function useUntaggedTransactions() {
  const q = useMemo(() => query(col, where("tagged", "==", false)), []);
  return useLiveQuery<Transaction>(q, "tx:untagged");
}

export function updateTransaction(id: string, patch: Partial<Omit<Transaction, "id">>) {
  return updateDoc(doc(col, id), patch);
}

export function tagTransaction(id: string, tag: string, note: string | null, type: TxType) {
  return updateTransaction(id, { tag, note, type, tagged: true, typeUncertain: false });
}

export function deleteTransaction(id: string) {
  return deleteDoc(doc(col, id));
}

export interface ManualTransactionInput {
  amount: number; // Rial
  type: TxType;
  bankId: string;
  timestamp: Date;
  tag: string | null;
  note: string | null;
}

export function addManualTransaction(t: ManualTransactionInput) {
  return addDoc(col, {
    amount: t.amount,
    type: t.type,
    bankId: t.bankId,
    timestamp: Timestamp.fromDate(t.timestamp),
    rawText: "",
    source: "manual",
    tag: t.tag,
    note: t.note,
    tagged: t.tag !== null,
    typeUncertain: false,
    createdAt: serverTimestamp(),
  });
}
