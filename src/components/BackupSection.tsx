import { useRef, useState } from "react";
import { makeBackup, useStore, type BackupData } from "../store/useStore";

/** Everything lives in this device's local storage — this is the way to move or back it up. */
export default function BackupSection() {
  const importBackup = useStore((s) => s.importBackup);
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function exportJson() {
    const data = JSON.stringify(makeBackup(useStore.getState()), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `personalcost-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function copyJson() {
    await navigator.clipboard?.writeText(JSON.stringify(makeBackup(useStore.getState())));
    setMsg("پشتیبان در کلیپ‌بورد کپی شد");
  }

  function load(text: string) {
    try {
      const d = JSON.parse(text) as BackupData;
      if (d.version !== 1 || !Array.isArray(d.transactions) || !Array.isArray(d.banks) || !Array.isArray(d.tags)) {
        throw new Error("فرمت فایل پشتیبان درست نیست");
      }
      if (!confirm(`${d.transactions.length} تراکنش بازیابی شود؟ داده‌های فعلی این دستگاه جایگزین می‌شوند.`)) return;
      importBackup(d);
      setMsg("بازیابی انجام شد");
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  return (
    <div className="stack">
      <p className="muted small">
        همه داده‌ها فقط روی همین دستگاه (در حافظه مرورگر/اپ) ذخیره می‌شوند و هیچ سروری در کار نیست. برای انتقال به دستگاه دیگر یا
        پشتیبان‌گیری، خروجی بگیرید و در دستگاه مقصد بازیابی کنید.
      </p>
      <div className="row">
        <button type="button" onClick={exportJson}>
          دانلود پشتیبان
        </button>
        <button type="button" onClick={copyJson}>
          کپی پشتیبان
        </button>
        <button type="button" onClick={() => fileRef.current?.click()}>
          بازیابی از فایل
        </button>
        <button
          type="button"
          onClick={async () => {
            const t = await navigator.clipboard?.readText().catch(() => "");
            if (t) load(t);
          }}
        >
          بازیابی از کلیپ‌بورد
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) load(await f.text());
          e.target.value = "";
        }}
      />
      {msg && <p className="muted small">{msg}</p>}
    </div>
  );
}
