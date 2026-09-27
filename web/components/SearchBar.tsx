interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export default function SearchBar({ value, onChange, placeholder }: Props) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder ?? '搜索...'}
      className="w-64 border border-[var(--al-input-border)] bg-[var(--al-input-bg)] text-[var(--al-input-text)] placeholder:text-[var(--al-input-placeholder)] rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--al-primary-border)]"
    />
  );
}
