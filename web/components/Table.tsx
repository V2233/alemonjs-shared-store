interface Column<T> {
  key: string;
  title: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  placeholder?: { text?: string };
}

export default function Table<T>({ columns, data, rowKey, onRowClick, placeholder }: Props<T>) {
  return (
    <div className="overflow-x-auto bg-[var(--al-table-bg)] rounded-lg border border-[var(--al-table-border)]">
      <table className="min-w-full divide-y divide-[var(--al-table-border)]">
        <thead className="bg-[var(--al-table-header-bg)]">
          <tr>
            {columns.map(c => (
              <th
                key={c.key}
                className={`px-4 py-3 text-left text-xs font-medium text-[var(--al-table-header-text)] uppercase tracking-wider ${c.className ?? ''}`}
              >
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--al-table-border)]">
          {data.map(row => (
            <tr
              key={rowKey(row)}
              onClick={() => onRowClick?.(row)}
              className={
                onRowClick
                  ? 'cursor-pointer hover:bg-[var(--al-table-row-hover)]'
                  : 'hover:bg-[var(--al-table-row-hover)]'
              }
            >
              {columns.map(c => (
                <td key={c.key} className="px-4 py-3 text-sm text-[var(--al-table-text)]">
                  {c.render ? c.render(row) : (row as any)[c.key]}
                </td>
              ))}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-[var(--al-muted)]">
                {placeholder?.text || '暂无数据'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
