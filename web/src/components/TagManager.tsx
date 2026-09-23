import { useState } from "react";
import { addTag, deleteTag, reorderTags, updateTag } from "../hooks/useTags";
import type { Tag } from "../types";

export default function TagManager({ tags }: { tags: Tag[] }) {
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("#0ea5e9");

  function move(i: number, dir: -1 | 1) {
    const ids = tags.map((t) => t.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reorderTags(ids);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const l = label.trim();
    if (!l || tags.some((t) => t.label === l)) return;
    await addTag(l, color, tags.length ? Math.max(...tags.map((t) => t.order)) + 1 : 0);
    setLabel("");
  }

  return (
    <div className="stack">
      <ul className="list">
        {tags.map((t, i) => (
          <li key={t.id} className="list-row">
            <input type="color" value={t.color} onChange={(e) => updateTag(t.id, { color: e.target.value })} />
            <span className="grow">{t.label}</span>
            <button type="button" className="icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="بالا">
              ▲
            </button>
            <button type="button" className="icon" onClick={() => move(i, 1)} disabled={i === tags.length - 1} aria-label="پایین">
              ▼
            </button>
            <button
              type="button"
              className="link danger"
              onClick={() => confirm(`تگ «${t.label}» حذف شود؟ (تراکنش‌های قبلی تغییری نمی‌کنند)`) && deleteTag(t.id)}
            >
              حذف
            </button>
          </li>
        ))}
      </ul>
      <form className="row" onSubmit={add}>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        <input className="grow" placeholder="تگ جدید" value={label} onChange={(e) => setLabel(e.target.value)} />
        <button type="submit">افزودن</button>
      </form>
    </div>
  );
}
