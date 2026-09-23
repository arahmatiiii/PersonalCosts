import type { Tag } from "../types";

interface Props {
  tags: Tag[];
  value: string | null;
  onPick: (label: string) => void;
  scroll?: boolean;
}

export default function TagChips({ tags, value, onPick, scroll }: Props) {
  if (tags.length === 0) return null;
  return (
    <div className={`chips${scroll ? " scroll" : ""}`} onClick={(e) => e.stopPropagation()}>
      {tags.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`chip${value === t.label ? " on" : ""}`}
          style={{ "--c": t.color } as React.CSSProperties}
          onClick={() => onPick(t.label)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
