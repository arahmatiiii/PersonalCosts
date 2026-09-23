import { addDoc, collection, deleteDoc, doc, orderBy, query, updateDoc } from "firebase/firestore";
import { useMemo } from "react";
import { db } from "../firebase";
import type { Bank } from "../types";
import { useLiveQuery } from "./useCollection";

const col = collection(db, "banks");
const q = query(col, orderBy("name"));

export function useBanks() {
  const result = useLiveQuery<Bank>(q, "banks");
  const byId = useMemo(() => new Map(result.data.map((b) => [b.id, b])), [result.data]);
  return { ...result, byId };
}

export function addBank(b: Omit<Bank, "id">) {
  return addDoc(col, b);
}

export function updateBank(id: string, patch: Partial<Omit<Bank, "id">>) {
  return updateDoc(doc(col, id), patch);
}

export function deleteBank(id: string) {
  return deleteDoc(doc(col, id));
}
