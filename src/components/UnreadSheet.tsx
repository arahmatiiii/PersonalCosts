import { GraduationCap, X } from "lucide-react";
import { useState } from "react";
import { formatRelative } from "../lib/format";
import { useStore } from "../store/useStore";
import type { UnreadSms } from "../types";
import Sheet from "./Sheet";
import TeachSheet from "./TeachSheet";

/** SMS from known banks the app couldn't read: teach a rule from one, or dismiss it. */
export default function UnreadSheet({ onClose }: { onClose: () => void }) {
  const { unread, banks, removeUnread } = useStore();
  const [teaching, setTeaching] = useState<UnreadSms | null>(null);

  return (
    <Sheet title="پیامک‌های نامفهوم" onClose={onClose}>
      <span className="muted small">
        این پیامک‌ها از بانک‌های تو آمده‌اند ولی مبلغشان خوانده نشد. روی «آموزش» بزن و مبلغ را نشان بده؛ پیامک‌های مشابه بعدی خودکار خوانده می‌شوند.
      </span>
      {unread.length === 0 ? (
        <div className="empty small">همه خوانده شدند</div>
      ) : (
        <>
          <div className="stack">
            {unread.map((u) => (
              <div key={u.id} className="card-soft unread-item">
                <div className="row small">
                  <b className="grow">{banks.find((b) => b.id === u.bankId)?.name ?? "بانک"}</b>
                  <span className="muted">{formatRelative(new Date(u.ts))}</span>
                </div>
                <pre className="raw">{u.text}</pre>
                <div className="row">
                  <button type="button" className="btn btn-primary grow" style={{ height: 40 }} onClick={() => setTeaching(u)}>
                    <GraduationCap size={18} /> آموزش
                  </button>
                  <button type="button" className="btn" style={{ height: 40 }} onClick={() => removeUnread([u.id])}>
                    <X size={16} /> تراکنش نیست
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="danger-btn" onClick={() => confirm("همه‌ی پیامک‌های نامفهوم پاک شوند؟") && removeUnread(unread.map((u) => u.id))}>
            پاک کردن همه
          </button>
        </>
      )}
      {teaching && <TeachSheet key={teaching.id} bankId={teaching.bankId} text={teaching.text} unreadId={teaching.id} onClose={() => setTeaching(null)} />}
    </Sheet>
  );
}
