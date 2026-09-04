import { OrderIcon } from './OrderIcon';

export function OrderPagination({
  count,
  page,
  canFirst,
  canPrevious,
  canNext,
  onFirst,
  onPrevious,
  onNext,
}: Readonly<{
  count: number;
  page: number;
  canFirst: boolean;
  canPrevious: boolean;
  canNext: boolean;
  onFirst: () => void;
  onPrevious: () => void;
  onNext: () => void;
}>) {
  return (
    <footer className="orderpagination" aria-label="订单分页">
      <span>第 {page} 页 · 本页 {count} 条</span>
      <div>
        {canFirst && !canPrevious ? (
          <button type="button" onClick={onFirst} aria-label="返回第一页">
            <OrderIcon name="arrowLeft" />
            返回第一页
          </button>
        ) : null}
        {canPrevious ? (
          <button type="button" onClick={onPrevious} aria-label="上一页">
            <OrderIcon name="arrowLeft" />
            上一页
          </button>
        ) : null}
        <strong aria-current="page">{page}</strong>
        {canNext ? (
          <button type="button" onClick={onNext} aria-label="下一页">
            下一页
            <OrderIcon name="arrowRight" />
          </button>
        ) : null}
      </div>
    </footer>
  );
}
