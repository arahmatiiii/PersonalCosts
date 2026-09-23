import { X } from "lucide-react";
import type { ReactNode } from "react";

export default function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grabber" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="بستن">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
