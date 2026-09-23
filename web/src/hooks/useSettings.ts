import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../firebase";
import { DEFAULT_SETTINGS, type UserSettings } from "../types";

const ref = doc(db, "settings", "user");

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [exists, setExists] = useState(false);

  useEffect(
    () =>
      onSnapshot(ref, (snap) => {
        setExists(snap.exists());
        setSettings({ ...DEFAULT_SETTINGS, ...(snap.data() as Partial<UserSettings> | undefined) });
        setLoading(false);
      }),
    [],
  );

  return { settings, loading, exists };
}

export function saveSettings(patch: Partial<UserSettings>) {
  return setDoc(ref, patch, { merge: true });
}
