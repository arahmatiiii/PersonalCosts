import { useMemo } from "react";
import { useStore } from "../store/useStore";
import BackupSection from "./BackupSection";
import BankList from "./BankList";
import CaptureSection from "./CaptureSection";
import ReminderTimePicker from "./ReminderTimePicker";
import TagManager from "./TagManager";

export default function SettingsPage() {
  const { banks, tags, settings } = useStore();
  const sortedTags = useMemo(() => [...tags].sort((a, b) => a.order - b.order), [tags]);
  const sortedBanks = useMemo(() => [...banks].sort((a, b) => a.name.localeCompare(b.name, "fa")), [banks]);

  return (
    <div className="page stack">
      <section className="card stack">
        <h2>دریافت خودکار</h2>
        <CaptureSection />
      </section>

      <section className="card stack">
        <h2>بانک‌ها</h2>
        <p className="muted small">
          هر بانک با نام پکیج اپ (برای اعلان) و/یا شناسه فرستنده پیامک شناسایی می‌شود و مبلغ با regex استخراج می‌شود. تغییرات فوراً
          اعمال می‌شوند.
        </p>
        <BankList banks={sortedBanks} />
      </section>

      <section className="card stack">
        <h2>یادآور</h2>
        <ReminderTimePicker settings={settings} />
      </section>

      <section className="card stack">
        <h2>تگ‌ها</h2>
        <TagManager tags={sortedTags} />
      </section>

      <section className="card stack">
        <h2>پشتیبان‌گیری</h2>
        <BackupSection />
      </section>
    </div>
  );
}
