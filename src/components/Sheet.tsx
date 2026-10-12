import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Each open sheet pushes a history entry, so Android's back button (WebView goBack) closes the top
 * sheet instead of leaving the app. Depth tells nested sheets apart.
 */
function useBackToClose(onClose: () => void) {
  const close = useRef(onClose);
  close.current = onClose;
  const st = useRef({ depth: 0, mounted: false });

  useEffect(() => {
    const s = st.current;
    s.mounted = true;
    if (!s.depth) {
      s.depth = ((history.state as { sheet?: number } | null)?.sheet ?? 0) + 1;
      history.pushState({ sheet: s.depth }, "");
    }
    const onPop = (e: PopStateEvent) => {
      if (((e.state as { sheet?: number } | null)?.sheet ?? 0) < s.depth) {
        s.depth = 0;
        close.current();
      }
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      s.mounted = false;
      // Closed by a button (not by back): drop our history entry. Deferred so StrictMode's
      // unmount/remount in dev doesn't pop it.
      setTimeout(() => {
        if (!s.mounted && s.depth && (history.state as { sheet?: number } | null)?.sheet === s.depth) history.back();
      });
    };
  }, []);
}

export default function Sheet({ title, onClose, children }: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  useBackToClose(onClose);
  return createPortal(
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
        <div className="grabber" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="بستن">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
