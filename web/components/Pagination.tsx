interface Props {
  page: number;
  size: number;
  total: number;
  onChange: (p: number) => void;
}

export default function Pagination({ page, size, total, onChange }: Props) {
  const pages = Math.max(1, Math.ceil(total / size));
  const canPrev = page > 1;
  const canNext = page < pages;

  // 显示页码：1 ... 当前-1 当前 当前+1 ... 尾页
  const numbers: (number | '...')[] = [];
  const push = (n: number | '...') => {
    if (numbers[numbers.length - 1] !== n) numbers.push(n);
  };
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) {
      push(i);
    } else if (numbers[numbers.length - 1] !== '...') {
      push('...');
    }
  }

  const btnBase =
    'px-3 py-1 text-sm border border-[var(--al-border)] rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--al-card-hover)]';

  return (
    <div className="flex items-center justify-center gap-1 flex-wrap">
      <button disabled={!canPrev} onClick={() => onChange(page - 1)} className={btnBase}>
        上一页
      </button>
      {numbers.map((n, i) =>
        n === '...' ? (
          <span key={`e${i}`} className="px-2 text-[var(--al-muted)]">
            ...
          </span>
        ) : (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={
              n === page
                ? 'px-3 py-1 text-sm rounded bg-[var(--al-button-bg)] text-[var(--al-button-text)] border border-[var(--al-button-bg)]'
                : btnBase
            }
          >
            {n}
          </button>
        )
      )}
      <button disabled={!canNext} onClick={() => onChange(page + 1)} className={btnBase}>
        下一页
      </button>
      <span className="ml-3 text-sm text-[var(--al-muted)]">
        共 {total} 条 / {pages} 页
      </span>
    </div>
  );
}
