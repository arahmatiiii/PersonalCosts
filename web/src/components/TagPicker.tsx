import type { Tag } from "../types";

interface Props {
  tags: Tag[];
  value: string | null;
  onPick: (label: string) => void;
  disabled?: boolean;
}

export default function TagPicker({ tags, value, onPick, disabled }: Props) {
  if (tags.length === 0) {
    return <p className="muted small">هنوز تگی تعریف نشده — از تنظیمات اضافه کنید.</p>;
  }
  return (
    <div className="chips">
      {tags.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`chip ${value === t.label ? "chip-active" : ""}`}
          style={{ "--chip": t.color } as React.CSSProperties}
          onClick={() => onPick(t.label)}
          disabled={disabled}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
