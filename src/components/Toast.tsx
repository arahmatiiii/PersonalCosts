import { Undo2 } from "lucide-react";
import { useEffect } from "react";
import { useStore } from "../store/useStore";

export default function Toast() {
  const toast = useStore((s) => s.toast);
  const hideToast = useStore((s) => s.hideToast);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(hideToast, toast.undo ? 5000 : 2500);
    return () => clearTimeout(t);
  }, [toast, hideToast]);

  if (!toast) return null;
  return (
    <div className="toast" role="status" key={toast.id}>
      <span className="grow">{toast.text}</span>
      {toast.undo && (
        <button
          type="button"
          className="toast-undo"
          onClick={() => {
            toast.undo?.();
            hideToast();
          }}
        >
          <Undo2 size={16} /> برگرداندن
        </button>
      )}
    </div>
  );
}
