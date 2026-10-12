import { Check, Download, Plus, ShieldCheck, Upload, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { faNum, normalizeDigits } from "../lib/format";
import { isNative, PersonalCost, type CaptureStatus } from "../native/personalCost";
import { makeBackup, useStore, type BackupData } from "../store/useStore";

const pad = (n: number) => String(n).padStart(2, "0");

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="section-title">{title}</div>
      <div className="card">{children}</div>
    </section>
  );
}

function PermissionsRow() {
  const [status, setStatus] = useState<CaptureStatus | null>(null);
  const refresh = useCallback(() => {
    PersonalCost.getStatus().then(setStatus).catch(() => {});
  }, []);
  useEffect(() => {
    refresh();
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  const ok = status && status.sms && status.postNotifications && status.batteryOptimizationIgnored;
  return (
    <div className="list-row">
      <ShieldCheck size={20} className="muted" />
      <span className="grow">دریافت خودکار پیامک</span>
      {ok ? (
        <span className="status ok">
          <Check size={16} /> فعال
        </span>
      ) : (
        <button type="button" className="btn btn-primary" style={{ height: 38 }} onClick={() => PersonalCost.requestAll().then(setStatus).catch(() => {})}>
          فعال‌سازی
        </button>
      )}
    </div>
  );
}

function Banks() {
  const { banks, addBank, deleteBank } = useStore();
  const [name, setName] = useState("");
  const [sender, setSender] = useState("");

  function add(e: React.FormEvent) {
    e.preventDefault();
    const s = sender.trim();
    if (!s) return;
    addBank(name.trim() || s, s);
    setName("");
    setSender("");
  }

  return (
    <>
      {banks.map((b) => (
        <div key={b.id} className="list-row">
          <div className="grow">
            <div style={{ fontWeight: 600 }}>{b.name}</div>
            <div className="muted small num" dir="ltr" style={{ textAlign: "right" }}>
              {b.sender}
            </div>
          </div>
          <button type="button" className="icon-btn" aria-label="حذف" onClick={() => confirm(`«${b.name}» حذف شود؟`) && deleteBank(b.id)}>
            <X size={18} />
          </button>
        </div>
      ))}
      <form className="list-row" onSubmit={add}>
        <input placeholder="نام بانک" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} />
        <input placeholder="سرشماره" dir="ltr" inputMode="tel" value={sender} onChange={(e) => setSender(e.target.value)} style={{ flex: 1.2 }} />
        <button type="submit" className="icon-btn primary" disabled={!sender.trim()} aria-label="افزودن">
          <Plus size={20} />
        </button>
      </form>
    </>
  );
}

function Tags() {
  const { tags, addTag, deleteTag } = useStore();
  const [label, setLabel] = useState("");
  function add(e: React.FormEvent) {
    e.preventDefault();
    const l = label.trim();
    if (l && !tags.some((t) => t.label === l)) addTag(l);
    setLabel("");
  }
  return (
    <div className="stack" style={{ padding: 16 }}>
      {tags.length > 0 && (
        <div className="chips">
          {tags.map((t) => (
            <span key={t.id} className="chip" style={{ "--c": t.color } as React.CSSProperties}>
              {t.label}
              <button type="button" className="x" aria-label="حذف" onClick={() => deleteTag(t.id)}>
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}
      <form className="row" onSubmit={add}>
        <input placeholder="تگ جدید" value={label} onChange={(e) => setLabel(e.target.value)} />
        <button type="submit" className="icon-btn primary" disabled={!label.trim()} aria-label="افزودن">
          <Plus size={20} />
        </button>
      </form>
    </div>
  );
}

function Backup() {
  const importBackup = useStore((s) => s.importBackup);
  const fileRef = useRef<HTMLInputElement>(null);

  function exportJson() {
    const blob = new Blob([JSON.stringify(makeBackup(useStore.getState()))], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `personalcost-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function load(file: File) {
    try {
      const d = JSON.parse(await file.text()) as BackupData;
      if (!Array.isArray(d.transactions) || !Array.isArray(d.banks) || !Array.isArray(d.tags)) throw new Error();
      if (confirm(`${d.transactions.length.toLocaleString("fa-IR")} تراکنش بازیابی شود؟ داده‌های فعلی جایگزین می‌شوند.`)) importBackup(d);
    } catch {
      alert("فایل پشتیبان معتبر نیست");
    }
  }

  return (
    <div className="row" style={{ padding: 12 }}>
      <button type="button" className="btn grow" onClick={exportJson}>
        <Download size={18} /> خروجی
      </button>
      <button type="button" className="btn grow" onClick={() => fileRef.current?.click()}>
        <Upload size={18} /> بازیابی
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) load(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export default function SettingsPage() {
  const { settings, saveSettings } = useStore();
  return (
    <>
      <h1 className="page-title">تنظیمات</h1>

      {isNative && (
        <Section title="دسترسی‌ها">
          <PermissionsRow />
        </Section>
      )}

      <Section title="بانک‌ها">
        <Banks />
      </Section>

      <Section title="یادآور روزانه">
        <div className="list-row">
          <label className="switch">
            <input type="checkbox" checked={settings.reminderEnabled} onChange={(e) => saveSettings({ reminderEnabled: e.target.checked })} />
            <span />
          </label>
          <span className="grow" />
          <div className="time-pick">
            <select
              className="num"
              value={settings.reminderHour}
              disabled={!settings.reminderEnabled}
              onChange={(e) => saveSettings({ reminderHour: Number(e.target.value) })}
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {pad(h)}
                </option>
              ))}
            </select>
            :
            <select
              className="num"
              value={settings.reminderMinute}
              disabled={!settings.reminderEnabled}
              onChange={(e) => saveSettings({ reminderMinute: Number(e.target.value) })}
            >
              {[0, 15, 30, 45].includes(settings.reminderMinute) ? null : <option value={settings.reminderMinute}>{pad(settings.reminderMinute)}</option>}
              {[0, 15, 30, 45].map((m) => (
                <option key={m} value={m}>
                  {pad(m)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      <Section title="تورم">
        <div className="list-row">
          <div className="grow">
            <div style={{ fontWeight: 600 }}>نرخ تورم سالانه</div>
            <div className="muted small">برای «به ارزش امروز» و مقایسه‌ی واقعی در آمار</div>
          </div>
          <div className="pct-input">
            <input
              className="num"
              inputMode="numeric"
              value={faNum(settings.inflationRate)}
              onChange={(e) => {
                const v = Number(normalizeDigits(e.target.value).replace(/\D/g, ""));
                saveSettings({ inflationRate: Math.min(500, v) });
              }}
              aria-label="نرخ تورم سالانه"
            />
            <span>٪</span>
          </div>
        </div>
      </Section>

      <Section title="تگ‌ها">
        <Tags />
      </Section>

      <Section title="پشتیبان‌گیری">
        <Backup />
      </Section>
    </>
  );
}
