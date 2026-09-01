import { OrderIcon } from './OrderIcon';

export function OrderPagination({
  count,
  nextCursor,
  onCursor,
}: Readonly<{
  count: number;
  nextCursor: string | undefined;
  onCursor: (cursor?: string) => void;
}>) {
  return (
    <footer className="orderpagination">
      <span>本页 {count} 条 · 全量总数不可用</span>
      <label>
        每页{' '}
        <select aria-label="每页数量" value="50" disabled>
          <option value="50">50</option>
        </select>
      </label>
      <div>
        <button type="button" disabled aria-label="上一页">
          <OrderIcon name="arrowLeft" />
        </button>
        <button type="button" onClick={() => onCursor(nextCursor)} disabled={nextCursor === undefined} aria-label="下一页">
          <OrderIcon name="arrowRight" />
        </button>
      </div>
    </footer>
  );
}
