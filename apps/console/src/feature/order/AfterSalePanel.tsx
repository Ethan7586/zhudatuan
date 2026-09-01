import type { UseQueryResult } from '@tanstack/react-query';
import { AfterSaleTable } from './AfterSaleTable';
import { OrderIcon } from './OrderIcon';
import type { readAftersales } from './AfterSaleQuery';

type AfterSalePage = Awaited<ReturnType<typeof readAftersales>>;

export function AfterSalePanel({
  query,
  error,
  selected,
  onOpen,
  onRetry,
}: Readonly<{
  query: UseQueryResult<AfterSalePage>;
  error: string | undefined;
  selected: string | undefined;
  onOpen: (order: string) => void;
  onRetry: () => void;
}>) {
  if (query.isPending)
    return (
      <p className="orderliststate" role="status">
        正在读取售后订单…
      </p>
    );
  if (query.isError && query.data === undefined)
    return (
      <section className="orderliststate" role="alert">
        <strong>售后订单读取失败</strong>
        <p>{error}</p>
        <button type="button" onClick={onRetry}>
          重试
        </button>
      </section>
    );
  if (query.data?.items.length === 0)
    return (
      <section className="orderliststate" role="status">
        <OrderIcon name="order" />
        <strong>暂无符合条件的售后订单</strong>
        <p>当前范围没有售后申请，或订单筛选条件未命中。</p>
      </section>
    );
  return query.data === undefined ? null : (
    <>
      <AfterSaleTable rows={query.data.items} {...(selected === undefined ? {} : { activeOrder: selected })} onOpen={onOpen} />
      {query.isError ? (
        <p className="orderstalebanner" role="status">
          刷新失败，当前保留最近一次已验证数据：{error}
        </p>
      ) : null}
    </>
  );
}
