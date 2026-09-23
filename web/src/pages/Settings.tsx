import { signOut } from "firebase/auth";
import { useState } from "react";
import BankList from "../components/BankList";
import ReminderTimePicker from "../components/ReminderTimePicker";
import TagManager from "../components/TagManager";
import { auth } from "../firebase";
import { useBanks } from "../hooks/useBanks";
import { useSettings } from "../hooks/useSettings";
import { useTags } from "../hooks/useTags";
import { seedDefaults } from "../lib/seed";

export default function Settings() {
  const { data: banks, loading: banksLoading } = useBanks();
  const { data: tags, loading: tagsLoading } = useTags();
  const { settings, exists: settingsExist, loading: settingsLoading } = useSettings();
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  const needsSeed =
    !banksLoading && !tagsLoading && !settingsLoading && (banks.length === 0 || tags.length === 0 || !settingsExist);

  async function seed() {
    try {
      const done = await seedDefaults();
      setSeedMsg(done.length ? `ایجاد شد: ${done.join("، ")}` : "چیزی برای ایجاد نبود");
    } catch (e) {
      setSeedMsg((e as Error).message);
    }
  }

  return (
    <div className="page stack">
      {needsSeed && (
        <section className="card stack">
          <p>به نظر می‌رسد اولین اجراست. بانک‌ها، تگ‌ها و تنظیمات پیش‌فرض ایجاد شوند؟</p>
          <button type="button" className="primary" onClick={seed}>
            ایجاد داده‌های پیش‌فرض
          </button>
        </section>
      )}
      {seedMsg && <p className="muted small">{seedMsg}</p>}

      <section className="card stack">
        <h2>بانک‌ها</h2>
        <p className="muted small">
          قوانین تشخیص در Firestore ذخیره می‌شوند؛ اپ اندروید در همگام‌سازی بعدی (باز کردن اپ یا هر ۶ ساعت) آن‌ها را می‌گیرد —
          نیازی به نصب مجدد نیست.
        </p>
        <BankList banks={banks} />
      </section>

      <section className="card stack">
        <h2>یادآور</h2>
        <ReminderTimePicker settings={settings} />
      </section>

      <section className="card stack">
        <h2>تگ‌ها</h2>
        <TagManager tags={tags} />
      </section>

      <section className="card row">
        <span className="grow muted small" dir="ltr">
          {auth.currentUser?.email}
        </span>
        <button type="button" onClick={() => signOut(auth)}>
          خروج
        </button>
      </section>
    </div>
  );
}
