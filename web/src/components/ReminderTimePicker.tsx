import { saveSettings } from "../hooks/useSettings";
import type { UserSettings } from "../types";

const pad = (n: number) => String(n).padStart(2, "0");

export default function ReminderTimePicker({ settings }: { settings: UserSettings }) {
  const value = `${pad(settings.reminderHour)}:${pad(settings.reminderMinute)}`;
  return (
    <div className="stack">
      <div className="row">
        <label className="switch">
          <input
            type="checkbox"
            checked={settings.reminderEnabled}
            onChange={(e) => saveSettings({ reminderEnabled: e.target.checked })}
          />
          <span />
        </label>
        <span className="grow">یادآور روزانه تگ‌زدن</span>
        <input
          type="time"
          dir="ltr"
          value={value}
          disabled={!settings.reminderEnabled}
          onChange={(e) => {
            const [h, m] = e.target.value.split(":").map(Number);
            if (!Number.isNaN(h) && !Number.isNaN(m)) saveSettings({ reminderHour: h, reminderMinute: m });
          }}
        />
      </div>
      <p className="muted small">
        یادآور توسط اپ اندروید همراه نمایش داده می‌شود؛ تغییر زمان در همگام‌سازی بعدی آن اپ (باز کردن اپ یا حداکثر ۶ ساعت) اعمال
        می‌شود.
      </p>
    </div>
  );
}
