import { collection, doc, getDoc, getDocs, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { DEFAULT_SETTINGS } from "../types";
import defaultBanks from "../seed/banks.json";
import defaultTags from "../seed/tags.json";

/** One-time seeding from the Settings page. Only fills in what doesn't exist yet. */
export async function seedDefaults(): Promise<string[]> {
  const done: string[] = [];
  const batch = writeBatch(db);

  if ((await getDocs(collection(db, "banks"))).empty) {
    for (const b of defaultBanks) batch.set(doc(collection(db, "banks")), b);
    done.push(`${defaultBanks.length} بانک`);
  }
  if ((await getDocs(collection(db, "tags"))).empty) {
    defaultTags.forEach((t, i) => batch.set(doc(collection(db, "tags")), { ...t, order: i }));
    done.push(`${defaultTags.length} تگ`);
  }
  const settingsRef = doc(db, "settings", "user");
  if (!(await getDoc(settingsRef)).exists()) {
    batch.set(settingsRef, DEFAULT_SETTINGS);
    done.push("تنظیمات یادآور");
  }
  await batch.commit();
  return done;
}
