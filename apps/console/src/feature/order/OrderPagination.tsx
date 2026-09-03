import { OrderIcon } from './OrderIcon';

export function OrderPagination({
  count,
  hasCursor,
  nextCursor,
  onCursor,
}: Readonly<{
  count: number;
  hasCursor: boolean;
  nextCursor: string | undefined;
  onCursor: (cursor?: string) => void;
}>) {
  return (
    <footer className="orderpagination">
      <span>本页 {count} 条</span>
      <div>
        {hasCursor ? (
          <button type="button" onClick={() => onCursor()} aria-label="返回第一页">
            <OrderIcon name="arrowLeft" />
            返回第一页
          </button>
        ) : null}
        {nextCursor === undefined ? null : (
          <button type="button" onClick={() => onCursor(nextCursor)} aria-label="下一页">
            下一页
            <OrderIcon name="arrowRight" />
          </button>
        )}
      </div>
    </footer>
  );
}
