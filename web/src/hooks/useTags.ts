import { addDoc, collection, deleteDoc, doc, orderBy, query, updateDoc, writeBatch } from "firebase/firestore";
import { useMemo } from "react";
import { db } from "../firebase";
import type { Tag } from "../types";
import { useLiveQuery } from "./useCollection";

const col = collection(db, "tags");
const q = query(col, orderBy("order"));

export function useTags() {
  const result = useLiveQuery<Tag>(q, "tags");
  const byLabel = useMemo(() => new Map(result.data.map((t) => [t.label, t])), [result.data]);
  return { ...result, byLabel };
}

export function addTag(label: string, color: string, order: number) {
  return addDoc(col, { label, color, order });
}

export function updateTag(id: string, patch: Partial<Omit<Tag, "id">>) {
  return updateDoc(doc(col, id), patch);
}

export function deleteTag(id: string) {
  return deleteDoc(doc(col, id));
}

/** Persist a new ordering (array of tag ids in desired order). */
export async function reorderTags(ids: string[]) {
  const batch = writeBatch(db);
  ids.forEach((id, i) => batch.update(doc(col, id), { order: i }));
  await batch.commit();
}
