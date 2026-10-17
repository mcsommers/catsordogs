import { useEffect, useRef, useState } from 'react';

type Option = { value: string; label: string };

export function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: Option[];
  selected: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const labels = options.filter((o) => selected.has(o.value)).map((o) => o.label);
  const summary =
    selected.size === 0
      ? 'All states'
      : labels.length <= 2
        ? labels.join(', ')
        : `${selected.size} selected`;

  function toggle(value: string) {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(next);
  }

  return (
    <div className="multi-select" ref={root}>
      <span className="multi-select-label">{label}</span>
      <button
        type="button"
        className="multi-select-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {summary}
      </button>
      {open ? (
        <div className="multi-select-panel" role="listbox" aria-multiselectable>
          {options.map((opt) => (
            <label key={opt.value} className="multi-select-option">
              <input
                type="checkbox"
                checked={selected.has(opt.value)}
                onChange={() => toggle(opt.value)}
              />
              {opt.label}
            </label>
          ))}
          {selected.size > 0 ? (
            <button type="button" className="ghost multi-select-clear" onClick={() => onChange(new Set())}>
              Clear selection
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
