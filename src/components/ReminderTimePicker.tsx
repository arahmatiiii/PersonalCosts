import { isNative } from "../native/personalCost";
import { useStore } from "../store/useStore";
import type { UserSettings } from "../types";

const pad = (n: number) => String(n).padStart(2, "0");

export default function ReminderTimePicker({ settings }: { settings: UserSettings }) {
  const saveSettings = useStore((s) => s.saveSettings);
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
        {isNative
          ? "یادآور هر روز در این ساعت تعداد تراکنش‌های تگ‌نخورده را اعلان می‌کند (اگر صفر باشد اعلانی نمی‌آید)."
          : "یادآور فقط در نسخه اندروید (APK) کار می‌کند."}
      </p>
    </div>
  );
}
