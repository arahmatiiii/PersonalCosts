import { useCallback, useEffect, useState } from "react";
import { drainCaptures } from "../native/bridge";
import { isNative, PersonalCost, type CaptureStatus } from "../native/personalCost";
import { useStore } from "../store/useStore";

/**
 * Android-only: makes every silent failure mode visible (listener access, SMS permission, battery
 * optimization) and shows the raw capture log used to verify bank package names / senders / regexes.
 */
export default function CaptureSection() {
  const { debugLog, clearDebug, captureAll, setCaptureAll } = useStore();
  const [status, setStatus] = useState<CaptureStatus | null>(null);
  const [showLog, setShowLog] = useState(false);

  const refresh = useCallback(() => {
    if (isNative) PersonalCost.getStatus().then(setStatus).catch(console.warn);
  }, []);

  useEffect(() => {
    refresh();
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  if (!isNative) {
    return (
      <p className="muted small">
        دریافت خودکار پیامک و اعلان بانک فقط در نسخه اندروید (APK) کار می‌کند. APK را از بخش Releases مخزن GitHub دانلود کنید.
      </p>
    );
  }

  const item = (label: string, ok: boolean | undefined, action: string, onClick: () => void) => (
    <li className="list-row">
      <span className="grow" style={{ color: ok ? "var(--income)" : "var(--expense)" }}>
        {ok ? "✅" : "❌"} {label}
      </span>
      {!ok && (
        <button type="button" onClick={() => onClick()}>
          {action}
        </button>
      )}
    </li>
  );

  const fmt = new Intl.DateTimeFormat("fa-IR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div className="stack">
      {status && !status.batteryOptimizationIgnored && (
        <p className="banner">
          ⚠️ بهینه‌سازی باتری برای این اپ فعال است. اندروید ممکن است سرویس دریافت اعلان را در پس‌زمینه متوقف کند و تراکنش‌ها
          بی‌صدا ثبت نشوند. حتماً غیرفعالش کنید.
        </p>
      )}
      <ul className="list">
        {item("دسترسی به اعلان‌ها (Notification access)", status?.notificationListener, "باز کردن تنظیمات", () =>
          PersonalCost.openNotificationListenerSettings(),
        )}
        {item("دسترسی پیامک", status?.sms, "اعطای دسترسی", () => PersonalCost.requestSmsPermission().then(refresh))}
        {item("اجازه نمایش اعلان (برای یادآور)", status?.postNotifications, "اعطای دسترسی", () =>
          PersonalCost.requestNotificationPermission().then(refresh),
        )}
        {item("مستثنی از بهینه‌سازی باتری", status?.batteryOptimizationIgnored, "درخواست", () =>
          PersonalCost.requestIgnoreBatteryOptimization(),
        )}
      </ul>
      <p className="muted small">
        در گوشی‌های شیائومی/سامسونگ/هواوی علاوه بر این، «اجرای خودکار» (Autostart) را فعال و اپ را در لیست اپ‌های اخیر قفل کنید.
      </p>

      <h3>لاگ خام پیامک‌ها/اعلان‌ها</h3>
      <p className="muted small">
        هر پیامک/اعلانی که به یک بانک تطبیق داده شده همراه با نتیجه اینجا ثبت می‌شود. UNPARSED یعنی regex مبلغ با متن جور نیست. این
        لاگ فقط روی همین گوشی است.
      </p>
      <div className="row">
        <label className="switch">
          <input type="checkbox" checked={captureAll} onChange={(e) => setCaptureAll(e.target.checked)} />
          <span />
        </label>
        <span className="grow small">ثبت همه اعلان‌ها و پیامک‌ها (برای پیدا کردن نام پکیج/فرستنده — بعد از استفاده خاموش کنید)</span>
      </div>
      <div className="row">
        <button type="button" onClick={() => setShowLog((s) => !s)}>
          {showLog ? "پنهان کردن لاگ" : `نمایش لاگ (${debugLog.length.toLocaleString("fa-IR")})`}
        </button>
        <button type="button" onClick={() => drainCaptures().then(refresh)}>
          بررسی الان
        </button>
        <button
          type="button"
          onClick={() =>
            navigator.clipboard
              ?.writeText(debugLog.map((e) => `[${new Date(e.t).toISOString()}] ${e.status} ← ${e.origin}\n${e.text}`).join("\n\n"))
              .catch(() => {})
          }
        >
          کپی
        </button>
        <button type="button" className="danger" onClick={clearDebug}>
          پاک کردن
        </button>
      </div>
      {showLog && (
        <ul className="list">
          {debugLog.length === 0 && <li className="muted small">(خالی)</li>}
          {debugLog.map((e, i) => (
            <li key={i} className="log-row">
              <div className="small">
                <b>{e.status}</b> · <span dir="ltr">{e.origin}</span> · <span className="muted">{fmt.format(e.t)}</span>
              </div>
              <pre className="raw">{e.text}</pre>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
