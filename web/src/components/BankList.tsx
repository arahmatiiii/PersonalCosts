import { useState } from "react";
import { deleteBank, updateBank } from "../hooks/useBanks";
import type { Bank } from "../types";
import BankForm from "./BankForm";

const isPlaceholder = (b: Bank) => [...b.matchPackages, ...b.matchSenderIds].some((v) => v.startsWith("VERIFY_ME"));

export default function BankList({ banks }: { banks: Bank[] }) {
  const [editing, setEditing] = useState<Bank | "new" | null>(null);

  if (editing) {
    return <BankForm initial={editing === "new" ? undefined : editing} onDone={() => setEditing(null)} />;
  }

  return (
    <div className="stack">
      <ul className="list">
        {banks.map((b) => (
          <li key={b.id} className="list-row">
            <label className="switch">
              <input type="checkbox" checked={b.enabled} onChange={(e) => updateBank(b.id, { enabled: e.target.checked })} />
              <span />
            </label>
            <div className="grow">
              <div>
                {b.name} {b.isDefault && <span className="badge">پیش‌فرض</span>}
              </div>
              <div className="muted small" dir="ltr">
                {[...b.matchPackages, ...b.matchSenderIds].join(" · ") || "—"}
              </div>
              {isPlaceholder(b) && (
                <div className="warn small">مقادیر پکیج/فرستنده هنوز placeholder هستند — روی گوشی بررسی و اصلاح کنید.</div>
              )}
            </div>
            <button type="button" className="link" onClick={() => setEditing(b)}>
              ویرایش
            </button>
            {!b.isDefault && (
              <button
                type="button"
                className="link danger"
                onClick={() => confirm(`«${b.name}» حذف شود؟`) && deleteBank(b.id)}
              >
                حذف
              </button>
            )}
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => setEditing("new")}>
        + افزودن بانک
      </button>
    </div>
  );
}
